import { spawnSync } from 'node:child_process';
import { joinBuildLock } from './buildLock.mjs';
import { REPO_ROOT } from './paths.mjs';

const ownerPath = process.argv[2];
const release = joinBuildLock(ownerPath);
// Each Node build step retains the lock if the build supervisor stops before its children.
const preload = new URL('./childBuildLock.mjs', import.meta.url).href;
const nodeOptions = [process.env.NODE_OPTIONS, `--import=${preload}`].filter(Boolean).join(' ');
const result = spawnSync('pnpm', ['--filter', '@textscene/web-previewer', 'build'], {
  cwd: REPO_ROOT,
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions, TEXTSCENE_PREVIEW_LOCK_OWNER: release.ownerPath },
});
process.exitCode = result.status ?? 1;
