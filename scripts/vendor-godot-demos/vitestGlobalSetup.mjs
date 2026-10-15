/** Vitest's global setup: the tests read the demo corpora, so a stale checkout vendors them first. */
export { ensureGodotDemos as setup } from './vendor.mjs';
