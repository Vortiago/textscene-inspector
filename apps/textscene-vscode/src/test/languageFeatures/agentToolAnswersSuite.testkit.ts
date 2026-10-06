/**
 * The agent tools a coding agent in chat calls, invoked through `vscode.lm.invokeTool` on a
 * copy of the shared fixture project. Each answer is the exact text the agent reads, so a
 * wrong path, a lost finding or a missing node fails here. The tools API is newer than the
 * `engines.vscode` floor, so on that VS Code every test skips with the reason.
 */

import * as assert from 'assert';
import type { Context } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import { PING_INTERVAL_MS, WEBVIEW_LOAD_DEADLINE_MS } from '../../previewCaptureQueue';
import { DISABLE_GPU_ENV } from '../integration/integrationLaunch';
import { EXTENSION_ID, previewTabLabels } from '../smokeProject/sceneEditor';
import { waitFor } from '../waitFor';
import { copyFixtureProject, removeFixtureProject } from './answers';

/** A lint or a tab update reaches the extension host well inside this on a loaded runner. */
const SETTLE_TIMEOUT_MS = 10000;

/**
 * The host ends the capture of a broken preview within this: the webview loads within the load
 * deadline, and an unanswered ping ends the request within two ping intervals. A failure then
 * prints the host's answer, not a test timeout.
 */
export const CAPTURE_TEST_TIMEOUT_MS = WEBVIEW_LOAD_DEADLINE_MS + 2 * PING_INTERVAL_MS + SETTLE_TIMEOUT_MS;

/** The first bytes of every PNG file. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The IHDR chunk follows the signature, and holds the width and height at these offsets. */
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;

/**
 * Three's error for a canvas with no WebGL 2 context (`WebGLRenderer.js`, three 0.186), which
 * R3F rethrows in render for the viewport's boundary to catch.
 */
const NO_WEBGL_REASON = 'The viewport crashed: THREE.WebGLRenderer: Error creating WebGL context.';

const NO_TOOLS_API = 'this VS Code predates vscode.lm.invokeTool, so no agent tool registers';

/** Every agent tool the extension contributes and registers. */
export const AGENT_TOOL_NAMES = [
  'textscene_lint',
  'textscene_scene_tree',
  'textscene_open_preview',
  'textscene_missing_resources',
  'textscene_capture',
] as const;

/** A language-model tool as an extension's manifest contributes it. */
export interface ContributedTool {
  readonly name: string;
  readonly when?: string;
}

/** The language-model tools the manifest of `extension` contributes, or none when it lists none. */
export function contributedTools(extension: vscode.Extension<unknown>): readonly ContributedTool[] {
  const contributes = extension.packageJSON.contributes as
    { languageModelTools?: ContributedTool[] } | undefined;
  return contributes?.languageModelTools ?? [];
}

/** Skips the test or the suite, and prints why, since mocha reports a skip with no reason. */
export function skipBecause(context: Context, reason: string): never {
  console.log(`    skipped: ${reason}`);
  context.skip();
}

/** Whether the launcher started the window with `--disable-gpu`, which leaves no WebGL context. */
export function launchedWithoutGpu(): boolean {
  const value = process.env[DISABLE_GPU_ENV];
  if (value !== '0' && value !== '1') {
    throw new Error(`expected the launcher to set ${DISABLE_GPU_ENV} to 0 or 1, got ${String(value)}`);
  }
  return value === '1';
}

/** The width and height a PNG's IHDR chunk records. */
function pngSize(data: Uint8Array): { width: number; height: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(PNG_WIDTH_OFFSET), height: view.getUint32(PNG_HEIGHT_OFFSET) };
}

/** The text parts of a tool result, one per line, whichever other parts it carries. */
export function textOf(result: vscode.LanguageModelToolResult): string {
  return result.content
    .map((part) => (part as { value?: unknown }).value)
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

/** The image part of a tool result, or undefined when it carries none. */
export function imageOf(
  result: vscode.LanguageModelToolResult
): { mimeType: string; data: Uint8Array } | undefined {
  return result.content.find(
    (part): part is { mimeType: string; data: Uint8Array } =>
      typeof (part as { mimeType?: unknown }).mimeType === 'string'
  );
}

/**
 * Defines the suite against a copy of the fixture project at `projectDir`, which must lie
 * inside the window's first workspace folder so a workspace-relative path names it.
 */
export function defineAgentToolAnswersSuite(projectDir: string): void {
  // Through `Uri.fsPath`, as the tools print it: it lowercases a Windows drive letter, and `path.join` does not.
  const scene = (file: string) => vscode.Uri.file(path.join(projectDir, file)).fsPath;
  const invoke = async (tool: string, scenePath: string) =>
    vscode.lm.invokeTool(tool, { input: { path: scenePath } });

  suite('Agent tool answers', function () {
    suiteSetup(async function () {
      if (typeof vscode.lm?.invokeTool !== 'function') skipBecause(this, NO_TOOLS_API);
      await copyFixtureProject(projectDir);
      await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    });

    suiteTeardown(async () => {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await removeFixtureProject(projectDir);
    });

    test('the lint tool reports a finding with its line, severity, message, rule and node', async () => {
      const missing = scene('missing.tscn');

      const text = textOf(await invoke('textscene_lint', missing));

      assert.strictEqual(
        text,
        [
          `${missing}: 1 finding.`,
          "  line 14: [warning] CollisionShape3D 'Shape' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry. (collisionshape3d-requires-shape) Shape (CollisionShape3D)",
        ].join('\n')
      );
    });

    test('the lint tool and the Problems panel give one verdict for a scene', async () => {
      const uri = vscode.Uri.file(scene('missing.tscn'));
      await vscode.window.showTextDocument(uri);
      const problems = () =>
        vscode.languages
          .getDiagnostics(uri)
          .filter((diagnostic) => diagnostic.source === 'tscn-lint')
          .map((diagnostic) => `${diagnostic.range.start.line + 1}:${String(diagnostic.code)}`);
      const text = textOf(await invoke('textscene_lint', uri.fsPath));
      const toolFindings = [...text.matchAll(/^ {2}line (\d+): \[\w+\] .* \(([a-z0-9-]+)\)/gm)].map(
        (match) => `${match[1]}:${match[2]}`
      );
      assert.ok(toolFindings.length > 0, `expected the tool to report a finding, found ${text}`);

      // The panel shows the file-local lint before the cross-file one, so wait for the full verdict.
      await waitFor(
        () => JSON.stringify(problems()) === JSON.stringify(toolFindings),
        SETTLE_TIMEOUT_MS,
        () =>
          `expected the Problems panel to show ${JSON.stringify(toolFindings)}, found ${JSON.stringify(problems())}`
      );
    });

    test('the lint tool reports no findings for a clean scene', async () => {
      const main = scene('main.tscn');

      assert.strictEqual(textOf(await invoke('textscene_lint', main)), `${main}: no findings.`);
    });

    test('the scene-tree tool returns the node hierarchy with each type', async () => {
      const main = scene('main.tscn');

      assert.strictEqual(
        textOf(await invoke('textscene_scene_tree', main)),
        [
          `${main}:`,
          '  Scene (Node3D)',
          '    Box (MeshInstance3D)',
          '      Lamp (OmniLight3D)',
          '    Floor (MeshInstance3D)',
        ].join('\n')
      );
    });

    test('the missing-resources tool lists only the res:// file the project lacks', async () => {
      const missing = scene('missing.tscn');

      assert.strictEqual(
        textOf(await invoke('textscene_missing_resources', missing)),
        `${missing}: 1 missing resource(s):\n  res://textures/missing.png`
      );
    });

    test('the missing-resources tool finds every resource of a complete scene', async () => {
      const main = scene('main.tscn');

      assert.strictEqual(
        textOf(await invoke('textscene_missing_resources', main)),
        `${main}: every referenced resource is present.`
      );
    });

    test('a workspace-relative path names the same scene as the absolute one', async () => {
      const folder = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
      const relative = path.relative(folder, scene('missing.tscn')).split(path.sep).join('/');

      assert.strictEqual(
        textOf(await invoke('textscene_missing_resources', relative)),
        textOf(await invoke('textscene_missing_resources', scene('missing.tscn')))
      );
    });

    test('a tool refuses a path that is not a .tscn scene, and names it', async () => {
      const notAScene = scene('project.godot');

      await assert.rejects(invoke('textscene_scene_tree', notAScene), (error: Error) =>
        error.message.includes(`Expected a .tscn scene, got '${notAScene}'`)
      );
    });

    test('the open-preview tool opens a preview tab for the scene', async () => {
      const text = textOf(await invoke('textscene_open_preview', scene('main.tscn')));

      assert.strictEqual(text, `Opened the TextScene preview for ${scene('main.tscn')}.`);
      await waitFor(
        () => previewTabLabels().includes('Preview: main.tscn'),
        SETTLE_TIMEOUT_MS,
        () => `expected a preview of main.tscn, found the tabs ${JSON.stringify(previewTabLabels())}`
      );
    });

    test('the capture tool returns a PNG of the rendered preview', async function () {
      if (typeof vscode.LanguageModelDataPart?.image !== 'function') {
        skipBecause(this, 'this VS Code predates the image part, so the capture tool does not register');
      }
      if (launchedWithoutGpu()) {
        skipBecause(this, 'the window launched with --disable-gpu, so the next test asserts the answer');
      }
      this.timeout(CAPTURE_TEST_TIMEOUT_MS);
      const main = scene('main.tscn');

      const result = await invoke('textscene_capture', main);
      const image = imageOf(result);

      assert.ok(image, `expected an image part, found the text ${JSON.stringify(textOf(result))}`);
      assert.strictEqual(textOf(result), `Rendered preview of ${main}.`);
      assert.strictEqual(image.mimeType, 'image/png');
      assert.deepStrictEqual([...image.data.slice(0, PNG_SIGNATURE.length)], PNG_SIGNATURE);
      const { width, height } = pngSize(image.data);
      assert.ok(width > 0 && height > 0, `expected a non-empty image, found ${width}x${height}`);
    });

    test('the capture tool names the missing WebGL context in a window launched without a GPU', async function () {
      if (typeof vscode.LanguageModelDataPart?.image !== 'function') {
        skipBecause(this, 'this VS Code predates the image part, so the capture tool does not register');
      }
      if (!launchedWithoutGpu()) {
        skipBecause(this, 'the window has a GPU, so the previous test asserts the image');
      }
      this.timeout(CAPTURE_TEST_TIMEOUT_MS);
      const main = scene('main.tscn');

      const result = await invoke('textscene_capture', main);

      assert.strictEqual(imageOf(result), undefined);
      assert.strictEqual(
        textOf(result),
        `The preview for ${main} did not return an image: ${NO_WEBGL_REASON}`
      );
    });
  });
}
