/**
 * Writes the smoke project to disk. A launcher writes it before VS Code starts, because
 * a folder created later never becomes a workspace folder.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SMOKE_PROJECT_FILES } from './scenes';

/** Writes the project into `workspaceRoot`, which must not exist yet. */
export function writeSmokeProject(workspaceRoot: string): void {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  for (const [name, content] of Object.entries(SMOKE_PROJECT_FILES)) {
    fs.writeFileSync(path.join(workspaceRoot, name), content);
  }
}
