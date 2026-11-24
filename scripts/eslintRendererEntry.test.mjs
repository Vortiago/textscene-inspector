import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { declaredExports } from '../packages/textscene-dev-kit/src/declaredExports.ts';
import { RENDERER_ENTRY_NAMES } from '../eslint.config.js';
import { findRepoRoot } from './repoRoot.mjs';

const root = findRepoRoot();
const eslint = new ESLint({ cwd: root });
const WEB = 'apps/textscene-web/src/sample.ts';
const WEBVIEW = 'apps/textscene-vscode/src/webview/sample.ts';
const EXTENSION_HOST = 'apps/textscene-vscode/src/sample.ts';
/** Held apart, so a scan of the imports through core does not read a sample here as one. */
const CORE = '@textscene/core';

/** How many imports the guard refuses in `code`, linted as the file at `path`. */
async function refusedIn(code, path) {
  const [result] = await eslint.lintText(code, { filePath: `${root}/${path}` });
  return result.messages.filter((message) => message.ruleId === 'no-restricted-imports').length;
}

describe('the renderer entry guard', () => {
  it('lists every name the entry exports', () => {
    const entryNames = declaredExports(`${root}/packages/textscene-core/src/r3f/renderer.ts`);
    expect([...RENDERER_ENTRY_NAMES].sort()).toEqual([...entryNames].sort());
  });

  it.each([WEB, WEBVIEW])('refuses a renderer name from core in %s', async (path) => {
    expect(await refusedIn(`import { openScene } from '${CORE}';`, path)).toBe(1);
  });

  it.each([WEB, WEBVIEW])('refuses the renderer entry of core in %s', async (path) => {
    expect(await refusedIn(`import { openScene } from '${CORE}/renderer';`, path)).toBe(1);
  });

  it('refuses core’s own path to the provider type', async () => {
    const code = `import type { ResourceProvider } from '${CORE}/resources/ResourceProvider';`;
    expect(await refusedIn(code, WEB)).toBe(1);
  });

  it('accepts the package entry, and a name of core that is not the renderer’s', async () => {
    const code = [
      "import { openScene } from '@textscene/renderer';",
      `import { TscnPreviewShell } from '${CORE}';`,
    ].join('\n');
    expect(await refusedIn(code, WEB)).toBe(0);
  });

  it('leaves the extension host, which lints through core and mounts no view', async () => {
    const code = `import type { ResourceProvider } from '${CORE}/resources/ResourceProvider';`;
    expect(await refusedIn(code, EXTENSION_HOST)).toBe(0);
  });
});
