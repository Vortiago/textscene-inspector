/**
 * In-frame read-out for the webview gate's noise run: the job workers the preview
 * started and the pixel replies they sent, as `installTextureWorkProbe` counted them.
 */
/* global window */
// `window` exists only in the webview frame, where `frame.evaluate` runs this.
export default function textureWorkReadout() {
  const probe = window.__textureWorkProbe;
  return probe ? { workers: probe.workers, replies: probe.replies } : null;
}
