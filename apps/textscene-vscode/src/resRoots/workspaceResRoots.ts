import * as vscode from 'vscode';
import { createResRoots, type ResRoot, type ResRoots } from '@textscene/core/resources/resRoots';
import { forwardSlashes, RES_SCHEME } from '@textscene/core/resources/resPath';
import { workspaceFsPort, workspaceUriAt } from './workspaceFsPort';

/** A core `res://` root with the Uri forms VS Code's editor features need. */
export interface WorkspaceResRoot {
  readonly uri: vscode.Uri;
  readonly root: ResRoot;
  uriOf(resPath: string): vscode.Uri | null;
  existingFile(resPath: string): Promise<vscode.Uri | null>;
}

export interface WorkspaceResRoots extends vscode.Disposable {
  /** The document's root, or null outside every workspace folder. */
  rootOf(document: vscode.Uri): Promise<WorkspaceResRoot | null>;
  /** Fires after the answers affected by a created or deleted path are dropped. */
  readonly onDidInvalidate: vscode.Event<vscode.Uri>;
}

function wrapRoot(folder: vscode.Uri, root: ResRoot): WorkspaceResRoot {
  const uriAt = (path: string | null) => (path === null ? null : workspaceUriAt(folder, path));
  return {
    uri: workspaceUriAt(folder, forwardSlashes(root.pathOf(RES_SCHEME)!)),
    root,
    uriOf: (resPath) => uriAt(root.pathOf(resPath)),
    existingFile: async (resPath) => uriAt(await root.resolve(resPath)),
  };
}

export function createWorkspaceResRoots(): WorkspaceResRoots {
  const byFolder = new Map<string, { uri: vscode.Uri; roots: ResRoots }>();
  const wrappers = new WeakMap<ResRoot, WorkspaceResRoot>();
  const changes = new vscode.EventEmitter<vscode.Uri>();
  const watcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false);

  const invalidate = (uri: vscode.Uri) => {
    // Sibling workspace folders can both use the Godot project above them.
    for (const entry of byFolder.values()) {
      if (entry.uri.scheme === uri.scheme && entry.uri.authority === uri.authority) {
        entry.roots.invalidate(uri.path);
      }
    }
    changes.fire(uri);
  };

  const disposables = [
    watcher,
    watcher.onDidCreate(invalidate),
    watcher.onDidDelete(invalidate),
    vscode.workspace.onDidChangeWorkspaceFolders(({ removed }) => {
      for (const folder of removed) byFolder.delete(folder.uri.toString());
    }),
    vscode.window.onDidChangeWindowState(({ focused }) => {
      if (focused) for (const { roots } of byFolder.values()) roots.invalidateAll();
    }),
    changes,
  ];

  return {
    async rootOf(document) {
      const folder = vscode.workspace.getWorkspaceFolder(document);
      if (!folder) return null;
      const key = folder.uri.toString();
      let entry = byFolder.get(key);
      if (!entry) {
        entry = { uri: folder.uri, roots: createResRoots(workspaceFsPort(folder), folder.uri.path) };
        byFolder.set(key, entry);
      }
      const root = await entry.roots.rootOf(document.path);
      if (!root) return null;
      let wrapper = wrappers.get(root);
      if (!wrapper) {
        wrapper = wrapRoot(folder.uri, root);
        wrappers.set(root, wrapper);
      }
      return wrapper;
    },
    onDidInvalidate: changes.event,
    dispose() {
      for (const disposable of disposables) disposable.dispose();
      byFolder.clear();
    },
  };
}
