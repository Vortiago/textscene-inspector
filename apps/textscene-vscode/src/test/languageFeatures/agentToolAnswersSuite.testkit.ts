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
import { waitFor } from '../waitFor';
import { copyFixtureProject, removeFixtureProject } from './answers';

/** A lint or a tab update reaches the extension host well inside this on a loaded runner. */
const SETTLE_TIMEOUT_MS = 10000;

/**
 * The webview gives a cold canvas 4s to mount before it answers no image, and a loaded
 * runner can need longer, so the test asks again until this passes.
 */
const CAPTURE_DEADLINE_MS = 30000;

/** The host answers a capture the webview never answers after 10s. */
const CAPTURE_TIMEOUT_MS = 10000;

/** The first bytes of every PNG file. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const NO_TOOLS_API = 'this VS Code predates vscode.lm.invokeTool, so no agent tool registers';

/** Skips the test or the suite, and prints why, since mocha reports a skip with no reason. */
function skipBecause(context: Context, reason: string): never {
  console.log(`    skipped: ${reason}`);
  context.skip();
}

/** The plain text of a tool result, whichever parts it carries. */
function textOf(result: vscode.LanguageModelToolResult): string {
  return result.content
    .map((part) => {
      const value = (part as { value?: unknown }).value;
      return typeof value === 'string' ? value : '';
    })
    .join('\n');
}

/** The image part of a tool result, or undefined when it carries none. */
function imageOf(result: vscode.LanguageModelToolResult): { mimeType: string; data: Uint8Array } | undefined {
  return result.content.find(
    (part): part is { mimeType: string; data: Uint8Array } =>
      typeof (part as { mimeType?: unknown }).mimeType === 'string'
  );
}

function previewTabLabels(): string[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith('tscnPreview')
    )
    .map((tab) => tab.label);
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

  /** The capture tool's result, asked again until it carries an image or the deadline passes. */
  const captureWithinDeadline = async (scenePath: string) => {
    const deadline = Date.now() + CAPTURE_DEADLINE_MS;
    let result = await invoke('textscene_capture', scenePath);
    while (!imageOf(result) && Date.now() < deadline) {
      result = await invoke('textscene_capture', scenePath);
    }
    return result;
  };

  suite('Agent tool answers', function () {
    suiteSetup(async function () {
      if (typeof vscode.lm?.invokeTool !== 'function') skipBecause(this, NO_TOOLS_API);
      copyFixtureProject(projectDir);
      await vscode.extensions.getExtension('vortiago.textscene-inspector')?.activate();
    });

    suiteTeardown(async () => {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      removeFixtureProject(projectDir);
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
      await waitFor(
        () => problems().length > 0,
        SETTLE_TIMEOUT_MS,
        () => 'no lint reached the Problems panel'
      );

      const text = textOf(await invoke('textscene_lint', uri.fsPath));
      const toolFindings = [...text.matchAll(/^ {2}line (\d+): \[\w+\] .* \(([a-z0-9-]+)\)/gm)].map(
        (match) => `${match[1]}:${match[2]}`
      );

      assert.deepStrictEqual(toolFindings, problems());
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
      if (process.platform === 'linux') {
        skipBecause(
          this,
          'both launchers pass --disable-gpu on Linux, so no WebGL context exists to capture'
        );
      }

      this.timeout(CAPTURE_DEADLINE_MS + SETTLE_TIMEOUT_MS);
      const result = await captureWithinDeadline(scene('main.tscn'));
      const image = imageOf(result);

      assert.ok(image, `expected an image part, found the text ${JSON.stringify(textOf(result))}`);
      assert.strictEqual(image.mimeType, 'image/png');
      assert.deepStrictEqual([...image.data.slice(0, PNG_SIGNATURE.length)], PNG_SIGNATURE);
    });

    // Runs on Linux too, where no WebGL context exists, so CI sees the failure answer.
    test('the capture tool answers a PNG, or names the scene and why it has no image', async function () {
      if (typeof vscode.LanguageModelDataPart?.image !== 'function') {
        skipBecause(this, 'this VS Code predates the image part, so the capture tool does not register');
      }
      this.timeout(CAPTURE_TIMEOUT_MS + SETTLE_TIMEOUT_MS);
      const main = scene('main.tscn');

      const result = await invoke('textscene_capture', main);
      const image = imageOf(result);

      if (image) {
        assert.deepStrictEqual([...image.data.slice(0, PNG_SIGNATURE.length)], PNG_SIGNATURE);
        return;
      }
      const prefix = `The preview for ${main} did not return an image: `;
      const text = textOf(result);
      assert.ok(
        text.startsWith(prefix),
        `expected the text to start ${JSON.stringify(prefix)}, found ${text}`
      );
      assert.ok(text.length > prefix.length, 'the answer names a reason');
    });
  });
}
