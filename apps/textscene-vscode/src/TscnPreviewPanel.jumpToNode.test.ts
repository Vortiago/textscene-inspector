/**
 * Unit tests for scene-tree "jump to node definition".
 *
 * Bug: `jumpToNode` resolved the target by a name-only text search and stopped at
 * the first `[node name="X"` line. With two same-named siblings it always jumped
 * to the first. These tests pin resolution by name + the Godot `parent=` value the
 * message now carries.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel } from './test-setup';

// Two nodes both named "Leaf" under different parents. Line indices:
//   0 [gd_scene ...]
//   1 [node name="Root" ...]
//   2 [node name="A" ... parent="."]
//   3 [node name="B" ... parent="."]
//   4 [node name="Leaf" ... parent="A"]   <- parent "A"
//   5 [node name="Leaf" ... parent="B"]   <- parent "B"
const TWO_SIBLINGS_TSCN = [
  '[gd_scene format=3]',
  '[node name="Root" type="Node3D"]',
  '[node name="A" type="Node3D" parent="."]',
  '[node name="B" type="Node3D" parent="."]',
  '[node name="Leaf" type="Node3D" parent="A"]',
  '[node name="Leaf" type="Node3D" parent="B"]',
].join('\n');

interface MockEditor {
  selection: { start: { line: number } } | undefined;
  revealRange: Mock;
}

/** Stub the jump's document read + editor, return the editor to inspect. */
function stubJumpTarget(documentText: string): MockEditor {
  (vscode.workspace.openTextDocument as Mock).mockResolvedValue({
    getText: () => documentText,
  });
  const editor: MockEditor = { selection: undefined, revealRange: vi.fn() };
  (vscode.window.showTextDocument as Mock).mockResolvedValue(editor);
  return editor;
}

async function createReadyPanel(triggerMessage: (msg: { type: string }) => void): Promise<void> {
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
    createMockFileData(TWO_SIBLINGS_TSCN)
  );
  TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/test.tscn'));
  await new Promise<void>((r) => setTimeout(r, 10));
  triggerMessage({ type: 'webviewReady' });
}

describe('TscnPreviewPanel jumpToNode parent resolution', () => {
  it('resolves a duplicate name to the sibling identified by parent (B)', async () => {
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    const editor = stubJumpTarget(TWO_SIBLINGS_TSCN);

    triggerMessage({ type: 'jumpToNode', nodeName: 'Leaf', path: 'Root/B/Leaf', parent: 'B' });
    await new Promise<void>((r) => setTimeout(r, 10));

    // The Leaf under parent="B" is on line index 5, not the first Leaf (line 4).
    expect(editor.selection?.start.line).toBe(5);
    expect(editor.revealRange).toHaveBeenCalled();
    expect((editor.revealRange.mock.calls[0]![0] as { start: { line: number } }).start.line).toBe(5);
  });

  it('resolves the other duplicate sibling by parent (A)', async () => {
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    const editor = stubJumpTarget(TWO_SIBLINGS_TSCN);

    triggerMessage({ type: 'jumpToNode', nodeName: 'Leaf', path: 'Root/A/Leaf', parent: 'A' });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(editor.selection?.start.line).toBe(4);
  });

  it('distinguishes a direct child of root (parent=".") from a deeper duplicate', async () => {
    // "Item" appears twice: under "A" (line 3) and directly under root (line 4).
    const fixture = [
      '[gd_scene format=3]',
      '[node name="Root" type="Node3D"]',
      '[node name="A" type="Node3D" parent="."]',
      '[node name="Item" type="Node3D" parent="A"]',
      '[node name="Item" type="Node3D" parent="."]',
    ].join('\n');
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    const editor = stubJumpTarget(fixture);

    triggerMessage({ type: 'jumpToNode', nodeName: 'Item', path: 'Root/Item', parent: '.' });
    await new Promise<void>((r) => setTimeout(r, 10));

    // The direct child (parent=".") is line 4 — not the first name match (line 3).
    expect(editor.selection?.start.line).toBe(4);
  });

  it('resolves the root node (no parent) to its heading', async () => {
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    const editor = stubJumpTarget(TWO_SIBLINGS_TSCN);

    // Root nodes carry no `parent` on the message.
    triggerMessage({ type: 'jumpToNode', nodeName: 'Root', path: 'Root' });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(editor.selection?.start.line).toBe(1);
  });

  it('falls back to the first name match when no parent is supplied (legacy)', async () => {
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    const editor = stubJumpTarget(TWO_SIBLINGS_TSCN);

    triggerMessage({ type: 'jumpToNode', nodeName: 'Leaf' });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(editor.selection?.start.line).toBe(4);
  });

  it('warns and opens no editor when the node is absent', async () => {
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    const editor = stubJumpTarget(TWO_SIBLINGS_TSCN);

    triggerMessage({ type: 'jumpToNode', nodeName: 'Nope', path: 'Root/Nope', parent: 'Root' });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(vscode.window.showWarningMessage as Mock).toHaveBeenCalled();
    expect(vscode.window.showTextDocument as Mock).not.toHaveBeenCalled();
    expect(editor.revealRange).not.toHaveBeenCalled();
  });
});
