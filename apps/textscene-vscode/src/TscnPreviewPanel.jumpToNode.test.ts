/**
 * Unit tests for scene-tree "jump to node definition". `jumpToNode` resolves the
 * target by name and the `parent=` value the message carries, so two same-named
 * nodes under different parents resolve apart.
 */
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import {
  createMockUri,
  createMockFileData,
  MockTabInputText,
  setupMockPanel,
} from './test-setup';

const SCENE_PATH = '/workspace/test.tscn';

// Two nodes named "Leaf", under A (line 4) and under B (line 5).
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
  TscnPreviewPanel.create(createMockUri('/extension'), createMockUri(SCENE_PATH));
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

    // The direct child (parent=".") is line 4, not the first name match (line 3).
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

interface MockTab {
  input: unknown;
  isActive: boolean;
}

/** An editor group in `viewColumn`, each tab pointing back at it as a real `Tab` does. */
function tabGroup(viewColumn: number, tabs: MockTab[]) {
  const group = { viewColumn, tabs: [] as Array<MockTab & { group: unknown }> };
  group.tabs = tabs.map((tab) => ({ ...tab, group }));
  return group;
}

/** A text editor tab for the file at `path`, on screen when `isActive`. */
function textTab(path: string, isActive: boolean): MockTab {
  return { input: new MockTabInputText(createMockUri(path)), isActive };
}

function openTabs(...groups: Array<ReturnType<typeof tabGroup>>): void {
  (vscode.window as unknown as { tabGroups: unknown }).tabGroups = { all: groups };
}

/** The `viewColumn` the jump asked `showTextDocument` for. */
async function jumpColumn(
  triggerMessage: ReturnType<typeof setupMockPanel>['triggerMessage']
): Promise<number> {
  stubJumpTarget(TWO_SIBLINGS_TSCN);
  triggerMessage({ type: 'jumpToNode', nodeName: 'Root', path: 'Root' });
  await new Promise<void>((r) => setTimeout(r, 10));
  const options = (vscode.window.showTextDocument as Mock).mock.calls[0]![1] as {
    viewColumn: number;
  };
  return options.viewColumn;
}

describe('TscnPreviewPanel jumpToNode editor column', () => {
  afterEach(() => {
    openTabs();
  });

  it('focuses the editor that already shows the scene in another column', async () => {
    openTabs(
      tabGroup(1, [textTab('/workspace/player.gd', true)]),
      tabGroup(3, [textTab(SCENE_PATH, true)])
    );
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);

    expect(await jumpColumn(triggerMessage)).toBe(vscode.ViewColumn.Three);
  });

  it('focuses a scene tab behind another tab instead of opening a duplicate', async () => {
    openTabs(
      tabGroup(1, [textTab('/workspace/player.gd', true)]),
      tabGroup(2, [textTab(SCENE_PATH, false), textTab('/workspace/level.gd', true)])
    );
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);

    expect(await jumpColumn(triggerMessage)).toBe(vscode.ViewColumn.Two);
  });

  it('prefers the column where the scene is on screen when two columns hold it', async () => {
    openTabs(
      tabGroup(2, [textTab(SCENE_PATH, false), textTab('/workspace/level.gd', true)]),
      tabGroup(3, [textTab(SCENE_PATH, true)])
    );
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);

    expect(await jumpColumn(triggerMessage)).toBe(vscode.ViewColumn.Three);
  });

  it('opens the scene in column one when no tab holds it', async () => {
    openTabs(tabGroup(2, [textTab('/workspace/player.gd', true)]));
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);

    expect(await jumpColumn(triggerMessage)).toBe(vscode.ViewColumn.One);
  });

  it('ignores a tab that shows the scene file in something other than a text editor', async () => {
    // A custom editor's input carries the same `uri`, but showing the text in that column
    // would open a second editor there, not focus one.
    openTabs(tabGroup(3, [{ input: { uri: createMockUri(SCENE_PATH) }, isActive: true }]));
    const { triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);

    expect(await jumpColumn(triggerMessage)).toBe(vscode.ViewColumn.One);
  });
});
