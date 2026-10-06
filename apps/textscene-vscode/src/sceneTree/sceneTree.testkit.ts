/// <reference types="vitest/globals" />

/**
 * Scene documents and previews for the Scene Tree tests.
 */

import * as vscode from 'vscode';
import { createMockDocument } from '../TscnDefinitionProvider.testkit';
import type { ScenePreview } from './activeScene';

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
  return createMockDocument(text, fsPath);
}

export function textEditor(document: vscode.TextDocument): vscode.TextEditor {
  return { document } as unknown as vscode.TextEditor;
}

/** A preview whose active state a test flips. */
export type FakePreview = { -readonly [K in keyof ScenePreview]: ScenePreview[K] };

export function fakePreview(fsPath: string, isActive: boolean): FakePreview {
  return { resource: vscode.Uri.file(fsPath), isActive, viewColumn: vscode.ViewColumn.Two };
}
