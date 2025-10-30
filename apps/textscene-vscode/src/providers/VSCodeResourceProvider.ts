/**
 * ResourceProvider implementation for VS Code environment.
 * Loads resources from the workspace filesystem.
 */

import * as vscode from 'vscode';
import { isBinaryResourceType, stripResPrefix } from '@textscene/renderer';
import type { ResourceProvider } from '@textscene/renderer';

export class VSCodeResourceProvider implements ResourceProvider {
  constructor(
    private workspaceRoot: vscode.Uri,
    private documentUri: vscode.Uri
  ) {}

  async loadResource(resourcePath: string, type: string): Promise<string | ArrayBuffer> {
    try {
      const fsPath = this.resolveGodotPath(resourcePath);
      const fileData = await vscode.workspace.fs.readFile(fsPath);

      // Return as ArrayBuffer for binary files (textures, audio)
      if (isBinaryResourceType(type)) {
        // Create a new ArrayBuffer from Uint8Array
        const buffer = new ArrayBuffer(fileData.byteLength);
        const view = new Uint8Array(buffer);
        view.set(fileData);
        return buffer;
      }

      // Return as string for text files (scenes, scripts, shaders)
      return new TextDecoder('utf-8').decode(fileData);
    } catch (error) {
      throw new Error(
        `Failed to load resource: ${resourcePath} (${error instanceof Error ? error.message : 'Unknown error'})`
      );
    }
  }

  /**
   * Convert Godot resource path (res://) to VS Code Uri.
   * Resolves relative to workspace root.
   */
  private resolveGodotPath(godotPath: string): vscode.Uri {
    const relativePath = stripResPrefix(godotPath);
    // For now, resolve relative to workspace root
    // In future, could also check relative to .tscn file directory
    return vscode.Uri.joinPath(this.workspaceRoot, relativePath);
  }
}
