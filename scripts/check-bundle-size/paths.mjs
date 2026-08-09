/**
 * Build-output locations both bundle-size guards read, resolved once so the
 * host guard and the webview budget can never disagree about where `dist/` is.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const WEBVIEW_DIR = join(REPO_ROOT, 'apps/textscene-vscode/dist/webview');
export const ENTRY = 'webview.js';

export const HOST_BUNDLE_PATHS = [
  join(REPO_ROOT, 'apps/textscene-vscode/dist/extension.js'),
  join(REPO_ROOT, 'apps/textscene-vscode/dist/extension.web.js'),
];

export function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}
