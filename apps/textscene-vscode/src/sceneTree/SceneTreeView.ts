/**
 * The Scene Tree view in the Explorer: the node tree of the active scene, whether its text
 * editor or its preview is the active editor. VS Code's Outline reads only a text editor, so
 * it says "The active editor cannot provide outline information" while a preview is active.
 */

import * as vscode from 'vscode';
import type { TscnPreviewPanel } from '../TscnPreviewPanel';
import { revealSceneLine } from '../jumpToNodeDefinition';
import { activeScene } from './activeScene';
import { REVEAL_SCENE_NODE_COMMAND, SceneTreeProvider } from './SceneTreeProvider';

export const SCENE_TREE_VIEW_ID = 'textscene.sceneTree';

/** The `when` clause of the view's contribution, so it shows only where the extension runs. */
export const SCENE_TREE_ENABLED_CONTEXT = 'textscene.sceneTreeEnabled';

export class SceneTreeView implements vscode.Disposable {
  private readonly _provider = new SceneTreeProvider();
  private readonly _view: vscode.TreeView<vscode.DocumentSymbol>;
  private readonly _disposables: vscode.Disposable[] = [];
  /**
   * Written only by `_refresh`, which takes the next number per call. Opening a scene is
   * asynchronous, so an open that finishes after a later one must not show its scene.
   */
  private _latestRefresh = 0;

  /** `previews` is the extension's live map of open previews, keyed by scene `Uri`. */
  public constructor(private readonly _previews: ReadonlyMap<string, TscnPreviewPanel>) {
    this._view = vscode.window.createTreeView(SCENE_TREE_VIEW_ID, { treeDataProvider: this._provider });
    this._disposables.push(
      this._view,
      this._provider,
      vscode.window.onDidChangeActiveTextEditor(() => void this._refresh()),
      vscode.workspace.onDidChangeTextDocument(({ document }) => this._showEdit(document)),
      vscode.commands.registerCommand(REVEAL_SCENE_NODE_COMMAND, (resource: vscode.Uri, line: number) =>
        revealSceneLine(resource, line, this._previews.get(resource.toString())?.viewColumn)
      )
    );
    void vscode.commands.executeCommand('setContext', SCENE_TREE_ENABLED_CONTEXT, true);
    void this._refresh();
  }

  /** Follows `preview` as it gains and loses the active editor slot, until it closes. */
  public follow(preview: TscnPreviewPanel): void {
    preview.onDidChangeViewState(() => void this._refresh(), null, this._disposables);
    preview.onDidDispose(() => void this._refresh(), null, this._disposables);
  }

  public dispose(): void {
    for (const disposable of this._disposables) disposable.dispose();
  }

  private async _refresh(): Promise<void> {
    const refresh = ++this._latestRefresh;
    const scene = activeScene(this._previews.values(), vscode.window.activeTextEditor);
    if (scene?.toString() === this._provider.document?.uri.toString()) return;

    const document = scene && (await openScene(scene));
    if (refresh !== this._latestRefresh) return;
    this._provider.show(document);
    this._view.description = document?.uri.path.split('/').pop();
  }

  /** An edit to the shown scene, unsaved or from disk, redraws the tree. */
  private _showEdit(document: vscode.TextDocument): void {
    if (document.uri.toString() === this._provider.document?.uri.toString()) {
      this._provider.show(document);
    }
  }
}

async function openScene(scene: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  try {
    return await vscode.workspace.openTextDocument(scene);
  } catch {
    // A preview can outlive its scene file: a branch switch or a rename removes it, and
    // the view then shows nothing, as the preview keeps its last render.
    return undefined;
  }
}
