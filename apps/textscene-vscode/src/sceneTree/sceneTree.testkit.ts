/// <reference types="vitest/globals" />

/**
 * Scene documents and previews for the Scene Tree tests.
 */

import * as vscode from 'vscode';
import { createMockUri, MockEventEmitter } from '../test-setup';

export const SCENE = [
  '[gd_scene format=3]',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  '',
  '[node name="Lamp" type="OmniLight3D" parent="Box"]',
  '',
].join('\n');

export function sceneDocument(fsPath: string, text = SCENE): vscode.TextDocument {
  return { uri: createMockUri(fsPath), getText: () => text } as unknown as vscode.TextDocument;
}

export function textEditor(document: vscode.TextDocument): vscode.TextEditor {
  return { document } as unknown as vscode.TextEditor;
}

/** A preview as the view reads it, with the view-state and dispose events it follows. */
export interface FakePreview {
  resource: vscode.Uri;
  isActive: boolean;
  viewColumn: vscode.ViewColumn | undefined;
  viewState: MockEventEmitter;
  disposed: MockEventEmitter;
  onDidChangeViewState: MockEventEmitter['event'];
  onDidDispose: MockEventEmitter['event'];
}

export function fakePreview(fsPath: string, isActive: boolean): FakePreview {
  const viewState = new MockEventEmitter();
  const disposed = new MockEventEmitter();
  return {
    resource: createMockUri(fsPath),
    isActive,
    viewColumn: vscode.ViewColumn.Two,
    viewState,
    disposed,
    onDidChangeViewState: viewState.event,
    onDidDispose: disposed.event,
  };
}
