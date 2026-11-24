import { existsSync } from 'node:fs';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { CORE_SOURCE, LAYERS } from './layers.mjs';
import { findRepoRoot } from '../repoRoot.mjs';

const root = findRepoRoot();
const eslint = new ESLint({ cwd: root });
const VIEW = `${CORE_SOURCE}r3f/sample.tsx`;
const EDITOR_VIEW = `${CORE_SOURCE}r3f/editorView/sample.tsx`;
const RENDERER_ENTRY = `${CORE_SOURCE}r3f/mountScene.tsx`;
const PREVIEWER = `${CORE_SOURCE}r3f/components/TscnPreviewShell/sample.tsx`;

/** How many imports the layer rule refuses in `code`, linted as the file at `path`. */
async function refusedIn(code, path) {
  const [result] = await eslint.lintText(code, { filePath: `${root}/${path}` });
  return result.messages.filter((message) => message.ruleId === 'layers/import-down').length;
}

describe('the layer rule', () => {
  it.each(LAYERS.flatMap((layer) => layer.paths))('names %s, which exists', (path) => {
    expect(existsSync(`${root}/${CORE_SOURCE}${path.replace(/\*\/$/, '')}`)).toBe(true);
  });

  it('refuses the editor view in a view module', async () => {
    expect(await refusedIn("import { a } from './editorView/freelook.js';", VIEW)).toBe(1);
  });

  it('refuses the previewer in an editor view module', async () => {
    const code = "import { a } from '../components/TscnPreviewShell/previewCamera.js';";
    expect(await refusedIn(code, EDITOR_VIEW)).toBe(1);
  });

  it('refuses the renderer entry in an editor view module', async () => {
    expect(await refusedIn("import { TscnCanvas } from '../TscnCanvas.js';", EDITOR_VIEW)).toBe(1);
  });

  it('refuses the previewer in the renderer entry', async () => {
    const code = "import { a } from './components/TscnPreviewShell/previewCamera.js';";
    expect(await refusedIn(code, RENDERER_ENTRY)).toBe(1);
  });

  it('refuses an upward re-export and an upward dynamic import', async () => {
    const code = [
      "export { a } from './editorView/freelook.js';",
      "export * from './editorView/freelook.js';",
      "const stage = import('./editorView/freelook.js');",
    ].join('\n');
    expect(await refusedIn(code, VIEW)).toBe(3);
  });

  it('refuses an upward type import and an upward import-equals', async () => {
    const code = [
      "type A = import('./editorView/freelook.js').A;",
      "import freelook = require('./editorView/freelook.js');",
    ].join('\n');
    expect(await refusedIn(code, VIEW)).toBe(2);
  });

  it('puts a new folder of components in the previewer', async () => {
    const code = "import { a } from './components/Splitter/Splitter.js';";
    expect(await refusedIn(code, VIEW)).toBe(1);
  });

  it('keeps a file beside the components folders in the first layer', async () => {
    const code = "import { a } from '../SelectionHighlight.js';";
    expect(await refusedIn(code, EDITOR_VIEW.replace('editorView', 'components/Splitter'))).toBe(0);
    expect(await refusedIn("import { a } from './components/SelectionHighlight.js';", VIEW)).toBe(0);
  });

  it('refuses a layer folder imported by its index', async () => {
    expect(await refusedIn("import { a } from './editorView';", VIEW)).toBe(1);
  });

  it('refuses an entry file imported by its folder', async () => {
    const code = ["import { a } from '../r3f';", "import { b } from '..';"].join('\n');
    expect(await refusedIn(code, `${CORE_SOURCE}godot/sample.ts`)).toBe(2);
  });

  it('refuses an upward import when ESLint runs from the package folder', async () => {
    const fromPackage = new ESLint({ cwd: `${root}/packages/textscene-core` });
    const [result] = await fromPackage.lintText("import { a } from './editorView/freelook.js';", {
      filePath: `${root}/${VIEW}`,
    });
    expect(result.messages.filter((message) => message.ruleId === 'layers/import-down')).toHaveLength(1);
  });

  it('accepts an import from the same layer and from the layers below', async () => {
    const code = [
      "import { a } from './freelook.js';",
      "import { NodeDispatcher } from '../NodeDispatcher.js';",
      "import type { Vector2 } from '../../godot/math/vector.js';",
      "import * as THREE from 'three';",
    ].join('\n');
    expect(await refusedIn(code, EDITOR_VIEW)).toBe(0);
  });

  it('accepts every layer in the previewer', async () => {
    const code = [
      "import { a } from '../../editorView/freelook.js';",
      "import { TscnCanvas } from '../../TscnCanvas.js';",
      "import { b } from '../ViewportToolbar/ViewportToolbar.js';",
    ].join('\n');
    expect(await refusedIn(code, PREVIEWER)).toBe(0);
  });

  it('leaves a test, which mounts any layer', async () => {
    const test = `${CORE_SOURCE}r3f/sample.test.tsx`;
    expect(await refusedIn("import { a } from './editorView/freelook.js';", test)).toBe(0);
  });
});
