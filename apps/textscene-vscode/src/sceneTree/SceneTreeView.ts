/**
 * The Scene Tree view in the Explorer: the node tree of the active scene, whether its text
 * editor or its preview is the active editor. VS Code's Outline reads only a text editor, so
 * it says "The active editor cannot provide outline information" while a preview is active.
 */

import * as vscode from 'vscode';
import { revealSceneLine } from '../jumpToNodeDefinition';
import { activeScene, type ScenePreview } from './activeScene';
import { REVEAL_SCENE_NODE_COMMAND, SceneTreeProvider } from './SceneTreeProvider';

export const SCENE_TREE_VIEW_ID = 'textscene.sceneTree';

/** The `when` clause of the view's contribution: the view stays hidden until a scene activates the extension. */
export const SCENE_TREE_ENABLED_CONTEXT = 'textscene.sceneTreeEnabled';

export class SceneTreeView implements vscode.Disposable {
  private readonly _provider = new SceneTreeProvider();
  private readonly _view: vscode.TreeView<vscode.DocumentSymbol>;
  private readonly _disposables: vscode.Disposable[] = [];
  /**
   * Written only by `_showActiveScene`, which takes the next number per call. Opening a scene is
   * asynchronous, so an open that finishes after a later one must not show its scene.
   */
  private _latestShow = 0;

  /** `_previews` is the extension's live map of open previews, keyed by scene `Uri`. */
  public constructor(private readonly _previews: ReadonlyMap<string, ScenePreview>) {
    this._view = vscode.window.createTreeView(SCENE_TREE_VIEW_ID, { treeDataProvider: this._provider });
    this._disposables.push(
      this._view,
      this._provider,
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.workspace.onDidChangeTextDocument((event) => this._showEdit(event)),
      vscode.commands.registerCommand(REVEAL_SCENE_NODE_COMMAND, (resource: vscode.Uri, line: number) =>
        revealSceneLine(resource, line, this._previews.get(resource.toString())?.viewColumn)
      )
    );
    void vscode.commands.executeCommand('setContext', SCENE_TREE_ENABLED_CONTEXT, true);
    this.refresh();
  }

  /** Shows the active scene. The extension calls it when a preview gains or loses the active slot, or closes. */
  public refresh(): void {
    void this._showActiveScene();
  }

  public dispose(): void {
    for (const disposable of this._disposables) disposable.dispose();
  }

  private async _showActiveScene(): Promise<void> {
    const show = ++this._latestShow;
    const scene = activeScene(this._previews.values(), vscode.window.activeTextEditor);
    if (this._isShown(scene)) return;

    const document = scene && (await openScene(scene));
    if (show !== this._latestShow) return;
    this._provider.show(document);
    this._view.description = document?.uri.path.split('/').pop();
  }

  /**
   * An edit to the shown scene, unsaved or from disk, redraws the tree. A save or a revert
   * fires with no content change, and the tree stays.
   */
  private _showEdit({ document, contentChanges }: vscode.TextDocumentChangeEvent): void {
    if (contentChanges.length > 0 && this._isShown(document.uri)) {
      this._provider.show(document);
    }
  }

  private _isShown(scene: vscode.Uri | undefined): boolean {
    return scene?.toString() === this._provider.document?.uri.toString();
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
