/**
 * The webview entry point: it mounts the R3F tree. `r3f-webview-main.tsx` holds
 * the mount and the extension-message wiring.
 */

// First, so the chunk importer is installed before the entry's other modules run. A shared
// chunk the entry imports runs before it, so a chunk import there must wait for a call.
import './chunkImport';
import { mountR3FWebview } from './r3f-webview-main';

mountR3FWebview();
