// Serializes all ORT session.run() calls across all models.
// ORT WASM uses numThreads=1 — concurrent inference doesn't parallelize,
// it just causes microtask interleaving overhead. A single queue eliminates that.
let _queue: Promise<unknown> = Promise.resolve();

export function withOrtQueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = _queue.then(fn);
  _queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
