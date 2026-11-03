/**
 * The webview entry point: it mounts the R3F tree. `r3f-webview-main.tsx` holds
 * the mount and the extension-message wiring.
 */

// First, so the chunk importer is installed before any module can load a chunk.
import './chunkImport';
import { mountR3FWebview } from './r3f-webview-main';

mountR3FWebview();
