/**
 * The packages of the pnpm workspace, found on disk the way the globs in `pnpm-workspace.yaml`
 * find them.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';

/** The folders that `packages/*` and `apps/*` in `pnpm-workspace.yaml` name. */
const WORKSPACE_FOLDERS = ['packages', 'apps'];

/**
 * Every directory one level under a workspace folder that holds a `package.json`, as an absolute
 * path.
 *
 * @canonical The workspace packages in a script
 */
export function workspacePackages() {
  return WORKSPACE_FOLDERS.flatMap((folder) =>
    readdirSync(join(REPO_ROOT, folder), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(REPO_ROOT, folder, entry.name))
      .filter((dir) => existsSync(join(dir, 'package.json')))
  );
}
