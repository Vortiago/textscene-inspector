#!/usr/bin/env node
/**
 * SessionStart hook: installs the Chromium of the locked Playwright, so a local visual run uses
 * the browser CI uses. The install is a no-op when that browser is present. A failed download
 * prints a warning and exits 0, because a session without network access can still edit code.
 */

import { spawnSync } from 'node:child_process';

import { playwrightInstallEnv } from '../../scripts/ci/playwrightInstallEnv.mjs';
import { REPO_ROOT } from '../../scripts/repoRoot.mjs';

const install = spawnSync('pnpm', ['playwright:install'], {
  cwd: REPO_ROOT,
  env: playwrightInstallEnv(process.env),
  stdio: ['ignore', 'ignore', 'inherit'],
});

if (install.status !== 0) {
  console.error('ensure-playwright-chromium: the install failed, so goldens may differ from CI.');
}
process.exit(0);
