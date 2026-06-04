# Concurrency bugs found & fixed — Phase 5e (2026-06-04)

While load- and concurrency-testing the Phase 5e console rewire (live Floor +
CRM views on the Django API), two **pre-existing backend concurrency defects**
surfaced. Both were in endpoints the new views call, neither was introduced by
the rewire, and both are now fixed and verified under real parallelism.

This document records the research, root cause, fix, verification, and the one
dead-end (WAL) that cost an iteration — so the reasoning isn't lost.

| # | Defect | Severity | Affected DB | Fixed in |
|---|--------|----------|-------------|----------|
| 1 | Optimistic-lock lost update (TOCTOU) | High (data correctness) | Postgres **and** SQLite | [`ops/floor_views.py`](../../backend/ops/floor_views.py) |
| 2 | Concurrent enroll returns HTTP 500 | Low (dev-DB only; data stayed correct) | SQLite only | [`common/apps.py`](../../backend/common/apps.py) |

Commit: `fix(ops): atomic compare-and-swap for table optimistic locking` (`17a1c0b`).

---

## How they were found

A small live probe ([`relish_correctness.py`](#appendix--the-probe)) fired
concurrent requests at the running server and asserted invariants:

- **Optimistic lock:** read a table's `version` (= V), then fire 15 parallel
  `set_status` requests **all carrying version V**. A correct optimistic lock
  must let *exactly one* win (200) and reject the other 14 as stale (409).
- **Enroll idempotency:** fire 10 parallel enrolls of the same new phone. The
  unique `(org_id, phone)` constraint must collapse them to **one** row, and
  every caller should get a clean 2xx (idempotent get-or-create).

First run:

```
[FAIL] 15 parallel writes @ same version → exactly 1×200 — 200s=2 409s=13
[FAIL] 10 parallel enrolls same phone → all accepted — accepted=1 codes={201, 500}
[PASS] 10 parallel enrolls → exactly ONE customer row (dedup) — rows=1
```

Two writers won the version race (should be one), and 9 of 10 concurrent
enrolls 500'd.

---

## Bug 1 — Optimistic-lock lost update (TOCTOU)

### Root cause

The table mutations (`seat`, `clear`, `set_status`, and `update`) used a
**read → compare-in-Python → save** sequence:

```python
table = self.get_object()                      # SELECT … version = V
if client_version != table.version:            # compare in Python  ← time A
    raise StaleVersionError()
table.status = new_status
table.version += 1
table.save()                                   # UPDATE … SET version = V+1  ← time B
```

Between **time A** (the check) and **time B** (the write) there is a window. Two
threads both read `version = V`, both pass the `V == V` check, and both issue an
unconditional `UPDATE … SET version = V+1`. Result: two logically distinct
updates collapse into one, `version` advances only once, and the second writer's
change silently clobbers the first — a classic **lost update / TOCTOU race**.

This is a Time-Of-Check-To-Time-Of-Use bug and it is **not** SQLite-specific —
the same window exists on Postgres, because nothing makes the check and the
write atomic (no row lock, no conditional predicate).

### Fix — atomic compare-and-swap

Push the version check *into* the write as a conditional `UPDATE` predicate, so
the database — not Python — enforces the guard:

```python
def _apply_versioned(pk, client_version, fields):
    qs = RestaurantTable.objects.filter(pk=pk)
    if client_version is not None:
        qs = qs.filter(version=client_version)          # WHERE version = V
    return qs.update(version=F("version") + 1,
                     updated_at=timezone.now(), **fields) > 0
```

Each action now does:

```python
if not _apply_versioned(table.pk, client_version, {"status": new_status}):
    raise StaleVersionError()                            # matched 0 rows → stale
```

The generated SQL is `UPDATE … SET version = version + 1, … WHERE id = ? AND version = V`.
Exactly one of N racing writers matches the `version = V` predicate; once it
commits, `version` is `V+1`, so every other writer matches **zero** rows and is
correctly rejected with 409.

Why this is correct on both engines:

- **Postgres (READ COMMITTED, the default):** when a concurrent transaction has
  modified the target row, an `UPDATE`'s `WHERE` is re-evaluated against the
  newly-committed row (EvalPlanQual). The losers re-check `version = V` against
  `V+1`, match nothing, and update 0 rows.
- **SQLite (rollback-journal, the dev/test default):** writers serialize on the
  database-level write lock; there is no MVCC snapshot, so each `UPDATE`
  re-reads the latest committed `version`. Only the first matches.

`client_version = None` (caller opted out of optimistic control) keeps the
legacy last-write-wins behaviour. The now-dead `_check_version` helper was
removed.

### After

```
[PASS] 15 parallel writes @ same version → exactly 1×200 — 200s=1 409s=14
```

---

## Bug 2 — Concurrent enroll returns HTTP 500

### Root cause

`POST /api/crm/customers/` enrolls by phone via
`Customer.objects.get_or_create(org_id=…, phone=…)` plus a one-time welcome
bonus (which writes a ledger row and updates the cached balance). Under
concurrency this is several writes per request.

On **SQLite with no `busy_timeout` configured**, the moment two requests try to
write at once the second one immediately raises `OperationalError: database is
locked` (SQLite serializes writes and, with the default zero timeout, does not
wait for the lock). That surfaced as a generic Django 500.

Crucially, **data stayed correct** — the unique `(org_id, phone)` constraint
still collapsed the rows to exactly one (the dedup assertion passed). And
`get_or_create` is already race-safe on Postgres (it catches the `IntegrityError`
and re-fetches). So this is a **dev-database artifact**, not a production
correctness bug — but a 500 under a burst of enrollments is still poor.

### Fix — `busy_timeout` on SQLite only

A `connection_created` receiver sets a busy timeout for SQLite connections, so a
writer **waits** for the lock (up to 5s) instead of erroring:

```python
@receiver(connection_created)
def _tune_sqlite(sender, connection, **kwargs):
    if connection.vendor != "sqlite":      # no-op on Postgres
        return
    connection.cursor().execute("PRAGMA busy_timeout=5000;")
```

Guarded by `connection.vendor`, so production (Postgres) is untouched.

### After

```
[PASS] 10 parallel enrolls same phone → all accepted — accepted=10 codes={200}
[PASS] 10 parallel enrolls → exactly ONE customer row (dedup) — rows=1
```

---

## The dead end: do **not** use WAL here

The first attempt at Bug 2 used `PRAGMA journal_mode=WAL` (the usual SQLite
concurrency advice). It fixed enroll — but **regressed Bug 1 to 6×200**.

WAL gives SQLite snapshot isolation: each transaction reads a consistent
snapshot taken when it began. Combined with per-request transactions, multiple
concurrent writers each read `version = V` from *their own snapshot*, so the
compare-and-swap `WHERE version = V` matches for several of them before the
writes serialize — defeating the optimistic lock.

So: **stay in the default rollback-journal mode; `busy_timeout` alone is
sufficient.** Rollback-journal has no snapshot isolation, so the CAS sees the
latest committed `version` and only one writer wins.

> ⚠️ `journal_mode` is **persistent in the database file**. If WAL is ever set
> accidentally, `db.sqlite3` stays in WAL across restarts. Revert with the
> server stopped (exclusive access required):
> ```bash
> sqlite3 db.sqlite3 "PRAGMA journal_mode=DELETE;"
> ```

---

## Verification

| Check | Result |
|-------|--------|
| Live concurrency/security probe | **12/12 pass** (auth 401, validation 400, lock 1×200+14×409, enroll all-200/1-row) |
| Backend suite (`pytest`) | **222 passed, 1 skipped** (RLS = Postgres-only) — unchanged baseline |
| Migration drift (`makemigrations --check`) | clean (view-logic only, no model changes) |
| Lint (`ruff check .`) | clean |
| Frontend (`tsc` + `vitest`) | tsc clean; **70 passed** (incl. 25 new mapping units) |

No regression: the change is view-logic + a connection pragma only.

---

## Scalability note (context for the load tests)

The same testing session clarified that the system is **throttle-bound by
design**, not raw-capacity bound. DRF `DEFAULT_THROTTLE_RATES`
([`config/settings.py`](../../backend/config/settings.py)):

| Scope | Rate | Keyed by |
|-------|------|----------|
| `user` | 1000/min (~16.7 rps) | authenticated user |
| `anon` | 60/min | client IP |
| `public_menu` | 120/min | IP |
| `dining_join` | 60/min | IP |
| `dining_pay` | 6/min | IP |

Consequences:

- A single-IP / single-user `ab`/`hey` run only measures the throttle — it
  returns fast **429s** (with `Retry-After`), not real throughput. Earlier
  "600–700 rps" figures were mostly 429s.
- True raw capacity needs a **Postgres staging env + many distinct IPs/users**.
  Dev is `runserver` (single process) + SQLite (serialized writes); production
  runs gunicorn + uvicorn workers + Postgres (see [`backend/DEPLOY.md`](../../backend/DEPLOY.md)).
- For real usage the floor view polls **1 GET / 5s / staff = 12/min**, ~1% of a
  user's 1000/min budget. The throttles exist to bound abuse; a restaurant's
  5–50 staff are nowhere near them.

---

## Appendix — the probe

The live probe used during this work is `relish_correctness.py` (kept out of the
repo, run from `/tmp` during the session). It logs in as the seeded staff user
(`staff@tabletheory.test`), then runs, all well under the 1000/min user
throttle:

1. **Auth gates** — GET tables/customers with no token and a garbage token → 401.
2. **Validation** — redeem negative / zero / over-balance points → 400; feedback
   `rating=9` → 400; `set_status` with an invalid enum → 400.
3. **Optimistic lock** — 15-way `ThreadPoolExecutor` of `set_status` at a fixed
   version; assert exactly 1×200 and 14×409.
4. **Enroll idempotency** — 10-way concurrent enroll of one phone; assert all
   accepted and exactly one row.

To reproduce: seed the demo (`python manage.py seed_table_theory`), run the dev
server, and re-create the probe against `http://127.0.0.1:8000/api`.
