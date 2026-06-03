"""The ``common`` app: the multi-tenancy core of the Relish restaurant-OS backend.

It owns the shared contracts every other app depends on: the active-tenant
contextvars (:mod:`common.context`), the tenant-resolving middleware
(:mod:`common.middleware`), the consistent error envelope
(:mod:`common.exceptions`), tenant-scoped base models/managers, the
``HasPermission`` factory, and the ``TenantViewSet`` base.
"""
