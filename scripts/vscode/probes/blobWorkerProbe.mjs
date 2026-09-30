/**
 * In-frame probe for the webview gate: can the preview start a blob-URL worker
 * under its CSP? It echoes one number through a worker, so a pass proves the
 * worker ran, not only that its construction did not throw.
 */
/* global Worker */
// `Worker` exists only in the webview frame, where `frame.evaluate` runs this.
export default async function blobWorkerProbe() {
  // Serialised by `frame.evaluate`, so it closes over nothing.
  const echoTimeoutMs = 5000;
  try {
    const source = 'onmessage = (event) => postMessage(event.data * 2);';
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const echoed = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no echo')), echoTimeoutMs);
      worker.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.onerror = (event) => {
        clearTimeout(timer);
        reject(new Error(`worker error: ${event.message ?? 'blocked'}`));
      };
      worker.postMessage(21);
    });
    worker.terminate();
    URL.revokeObjectURL(url);
    return { ok: echoed === 42, echoed, error: null };
  } catch (error) {
    return { ok: false, echoed: null, error: String(error) };
  }
}
