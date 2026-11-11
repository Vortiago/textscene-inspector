/**
 * Runs the experiment `?experiment=` names on the page's canvas and leaves its findings in
 * `window.__labResult`, or the error in `window.__labError`, for `run.mjs` to read.
 */

/* global window, document */ // The page runs in the browser.

const EXPERIMENTS = {
  adapter: () => import('./experiments/adapter.js'),
  'shadow-depth': () => import('./experiments/shadowDepth.js'),
  'full-screen': () => import('./experiments/fullScreen.js'),
  readback: () => import('./experiments/readback.js'),
  'lit-surface': () => import('./experiments/litSurface.js'),
  transpiled: () => import('./experiments/transpiled.js'),
  'light-quad': () => import('./experiments/lightQuad.js'),
  'fiber-mount': () => import('./experiments/fiberMount.js'),
};

async function runRequested() {
  const name = new URLSearchParams(window.location.search).get('experiment');
  const load = EXPERIMENTS[name];
  if (!load) throw new Error(`expected one of ${Object.keys(EXPERIMENTS).join(', ')}, got ${name}`);
  const { run } = await load();
  return run(document.getElementById('lab'));
}

runRequested().then(
  (result) => {
    window.__labResult = result;
  },
  (error) => {
    window.__labError = String(error?.stack ?? error);
  }
);
