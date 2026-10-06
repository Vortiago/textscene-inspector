/**
 * The Scene Tree view follows the active scene through its text editor and its preview.
 * VS Code's Outline goes empty while a preview is the active editor, and this view must not.
 */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { SCENE_TREE_ENABLED_CONTEXT, SCENE_TREE_VIEW_ID, SceneTreeView } from './SceneTreeView';
import { REVEAL_SCENE_NODE_COMMAND, type SceneTreeProvider } from './SceneTreeProvider';
import { fakePreview, sceneDocument, textEditor, type FakePreview } from './sceneTree.testkit';
import { MockEventEmitter } from '../test-setup';

const MAIN = '/workspace/main.tscn';
const LEVEL = '/workspace/level.tscn';

interface Harness {
  provider: SceneTreeProvider;
  view: { description: string | undefined };
  activeEditorChanged: MockEventEmitter;
  documentChanged: MockEventEmitter;
  commands: Map<string, (...args: unknown[]) => unknown>;
}

let harness: Harness;
let previews: Map<string, FakePreview>;

beforeEach(() => {
  const view = { description: undefined, dispose: vi.fn() };
  const activeEditorChanged = new MockEventEmitter();
  const documentChanged = new MockEventEmitter();
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  harness = { provider: undefined!, view, activeEditorChanged, documentChanged, commands };

  (vscode.window.createTreeView as Mock).mockImplementation(
    (_id: string, options: { treeDataProvider: SceneTreeProvider }) => {
      harness.provider = options.treeDataProvider;
      return view;
    }
  );
  (vscode.window.onDidChangeActiveTextEditor as Mock).mockImplementation(activeEditorChanged.event);
  (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation(documentChanged.event);
  (vscode.commands.registerCommand as Mock).mockImplementation(
    (command: string, handler: (...args: unknown[]) => unknown) => {
      commands.set(command, handler);
      return { dispose: vi.fn() };
    }
  );
  (vscode.workspace.openTextDocument as Mock).mockImplementation((uri: vscode.Uri) =>
    Promise.resolve(sceneDocument(uri.fsPath))
  );
  (vscode.window as { activeTextEditor: unknown }).activeTextEditor = undefined;
  previews = new Map();
});

function createView(): SceneTreeView {
  return new SceneTreeView(previews);
}

function openPreview(fsPath: string, isActive: boolean): FakePreview {
  const preview = fakePreview(fsPath, isActive);
  previews.set(preview.resource.toString(), preview);
  return preview;
}

function focusEditor(fsPath: string | undefined): void {
  const editor = fsPath === undefined ? undefined : textEditor(sceneDocument(fsPath));
  (vscode.window as { activeTextEditor: unknown }).activeTextEditor = editor;
  harness.activeEditorChanged.fire(editor);
}

/** Lets every pending scene open settle. */
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function shownScene(): string | undefined {
  return harness.provider.document?.uri.fsPath;
}

function rootNames(): string[] {
  return harness.provider.getChildren().map((symbol) => symbol.name);
}

describe('SceneTreeView', () => {
  it('registers its tree under the contributed view id and enables the view', () => {
    createView();

    expect(vscode.window.createTreeView).toHaveBeenCalledWith(SCENE_TREE_VIEW_ID, expect.any(Object));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      SCENE_TREE_ENABLED_CONTEXT,
      true
    );
  });

  it('keeps the node tree while the preview is the active editor', async () => {
    const view = createView();
    focusEditor(MAIN);
    await settle();
    const preview = openPreview(MAIN, false);

    // Focusing the preview takes the text editor away, the step that empties the Outline.
    focusEditor(undefined);
    preview.isActive = true;
    view.refresh();
    await settle();

    expect(shownScene()).toBe(MAIN);
    expect(rootNames()).toEqual(['Scene']);
  });

  it('shows the scene of a preview opened with no text editor behind it', async () => {
    const view = createView();

    openPreview(MAIN, true);
    view.refresh();
    await settle();

    expect(shownScene()).toBe(MAIN);
    expect(harness.view.description).toBe('main.tscn');
  });

  it('switches to the scene of the text editor that takes over from a preview', async () => {
    const view = createView();
    const preview = openPreview(MAIN, true);
    view.refresh();
    await settle();

    preview.isActive = false;
    focusEditor(LEVEL);
    await settle();

    expect(shownScene()).toBe(LEVEL);
  });

  it('empties when the active editor is not a scene', async () => {
    createView();
    focusEditor(MAIN);
    await settle();

    focusEditor('/workspace/player.gd');
    await settle();

    expect(shownScene()).toBeUndefined();
    expect(rootNames()).toEqual([]);
    expect(harness.view.description).toBeUndefined();
  });

  it('empties when the active preview closes', async () => {
    const view = createView();
    const preview = openPreview(MAIN, true);
    view.refresh();
    await settle();

    previews.delete(preview.resource.toString());
    view.refresh();
    await settle();

    expect(shownScene()).toBeUndefined();
  });

  it('shows nothing for a scene that can no longer be opened', async () => {
    const view = createView();
    (vscode.workspace.openTextDocument as Mock).mockRejectedValue(new Error('file not found'));

    openPreview(MAIN, true);
    view.refresh();
    await settle();

    expect(shownScene()).toBeUndefined();
  });

  it('drops an open that finishes after a later focus change', async () => {
    createView();
    let finishMainOpen!: () => void;
    (vscode.workspace.openTextDocument as Mock).mockImplementationOnce(
      (uri: vscode.Uri) =>
        new Promise((resolve) => {
          finishMainOpen = () => resolve(sceneDocument(uri.fsPath));
        })
    );

    focusEditor(MAIN);
    focusEditor(LEVEL);
    await settle();
    finishMainOpen();
    await settle();

    expect(shownScene()).toBe(LEVEL);
  });

  it('redraws the tree when the shown scene is edited', async () => {
    createView();
    focusEditor(MAIN);
    await settle();
    const listener = vi.fn();
    harness.provider.onDidChangeTreeData(listener);

    const edited = sceneDocument(MAIN, '[gd_scene format=3]\n\n[node name="Renamed" type="Node3D"]\n');
    harness.documentChanged.fire({ document: edited, contentChanges: [{}] });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(rootNames()).toEqual(['Renamed']);
  });

  it('ignores an edit to a scene it does not show', async () => {
    createView();
    focusEditor(MAIN);
    await settle();
    const listener = vi.fn();
    harness.provider.onDidChangeTreeData(listener);

    harness.documentChanged.fire({ document: sceneDocument(LEVEL), contentChanges: [{}] });

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the tree through a save, which changes no content', async () => {
    createView();
    focusEditor(MAIN);
    await settle();
    const listener = vi.fn();
    harness.provider.onDidChangeTreeData(listener);

    harness.documentChanged.fire({ document: sceneDocument(MAIN), contentChanges: [] });

    expect(listener).not.toHaveBeenCalled();
  });

  it('reveals a clicked node beside the preview of its scene', async () => {
    createView();
    const preview = openPreview(MAIN, true);
    (vscode.window.showTextDocument as Mock).mockResolvedValue({ revealRange: vi.fn() });

    await harness.commands.get(REVEAL_SCENE_NODE_COMMAND)!(preview.resource, 4);

    // The preview sits in column two, so the scene text opens in column one, not over it.
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(expect.anything(), {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
  });

  it("puts the cursor on the clicked node's heading line", async () => {
    createView();
    const editor = { selection: undefined as { start: { line: number } } | undefined, revealRange: vi.fn() };
    (vscode.window.showTextDocument as Mock).mockResolvedValue(editor);

    await harness.commands.get(REVEAL_SCENE_NODE_COMMAND)!(vscode.Uri.file(MAIN), 4);

    expect(editor.selection?.start.line).toBe(4);
    expect(editor.revealRange).toHaveBeenCalled();
  });

  it('reports a node it cannot reveal as an error, not a throw', async () => {
    createView();
    (vscode.workspace.openTextDocument as Mock).mockRejectedValue(new Error('file not found'));

    await harness.commands.get(REVEAL_SCENE_NODE_COMMAND)!(vscode.Uri.file(MAIN), 4);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to jump to node: file not found');
  });
});
