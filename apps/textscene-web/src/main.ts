/**
 * Standalone web application for previewing TSCN files.
 *
 * The R3F path is the only path. Mounts `<TscnPreviewShell>`
 * with the fixture-selector toolbar into the body's `#app` container.
 */

import { initLogger } from './logger';
import { mountR3F } from './r3f-main';

initLogger();

const appElement = document.getElementById('app');
if (!appElement) {
  throw new Error('Missing #app container');
}
mountR3F(appElement);
