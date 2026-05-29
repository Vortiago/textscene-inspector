/**
 * TSCN webview entry point — runs inside the VS Code webview.
 *
 * Post-WI-R3F-6 the imperative bootstrap is gone; the webview always
 * mounts the R3F tree. The actual mount + extension-message wiring
 * lives in `r3f-webview-main.tsx` so the React surface stays out of
 * the imperative-side bundle if we ever revive code-splitting.
 */

import { mountR3FWebview } from './r3f-webview-main';

mountR3FWebview();
