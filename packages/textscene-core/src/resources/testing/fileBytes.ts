/** A file read as the bytes a host provider hands over. */

import { readFileSync } from 'node:fs';

/** The file as a standalone ArrayBuffer, since a Node Buffer is a view into a shared pool. */
export function fileBytes(path: string): ArrayBuffer {
  return new Uint8Array(readFileSync(path)).buffer;
}
