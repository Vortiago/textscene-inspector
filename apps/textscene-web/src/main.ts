/**
 * The standalone web previewer: it mounts `<TscnPreviewShell>` with the fixture
 * toolbar into the body's `#app` container.
 */

import { initLogger } from './logger';
import { mountR3F } from './r3f-main';

initLogger();

const appElement = document.getElementById('app');
if (!appElement) {
  throw new Error('Missing #app container');
}
mountR3F(appElement);
