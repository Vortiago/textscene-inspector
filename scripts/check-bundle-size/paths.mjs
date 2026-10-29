/**
 * Build-output locations both bundle-size guards read, resolved once so the
 * host guard and the webview budget can never disagree about where `dist/` is.
 */

import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';

export { REPO_ROOT };
export const WEBVIEW_DIR = join(REPO_ROOT, 'apps/textscene-vscode/dist/webview');
export const ENTRY = 'webview.js';
/** The webview build's metafile, beside the host metafiles that `.vscodeignore` keeps out of the VSIX. */
export const WEBVIEW_METAFILE = join(REPO_ROOT, 'apps/textscene-vscode/dist/webview.meta.json');

export const HOST_BUNDLE_PATHS = [
  join(REPO_ROOT, 'apps/textscene-vscode/dist/extension.js'),
  join(REPO_ROOT, 'apps/textscene-vscode/dist/extension.web.js'),
];

export function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}
