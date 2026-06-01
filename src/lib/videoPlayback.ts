// Global playback governor: caps how many <video> elements decode at once so a
// fast scroll through a video-heavy menu can't spin up N simultaneous H.264
// decoders and jank low-end phones. IntersectionObserver decides *intent*; this
// module decides *who actually gets to play right now*.

const MAX_CONCURRENT = 6

interface Waiter {
  video: HTMLVideoElement
  resume: () => void
}

const playing = new Set<HTMLVideoElement>()
const queue: Waiter[] = []

/**
 * Request a playback slot. Returns true if granted immediately (caller should
 * start playback now). Returns false if the cap is full — the video is queued
 * and its `resume` callback fires when a slot frees.
 */
export function acquire(video: HTMLVideoElement, resume: () => void): boolean {
  if (playing.has(video)) return true
  if (playing.size < MAX_CONCURRENT) {
    playing.add(video)
    return true
  }
  if (!queue.some(w => w.video === video)) queue.push({ video, resume })
  return false
}

/** Release a slot (video paused / left viewport / unmounted) and promote queued waiters. */
export function release(video: HTMLVideoElement): void {
  playing.delete(video)
  const queued = queue.findIndex(w => w.video === video)
  if (queued >= 0) queue.splice(queued, 1)

  while (playing.size < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    playing.add(next.video)
    next.resume()
  }
}
