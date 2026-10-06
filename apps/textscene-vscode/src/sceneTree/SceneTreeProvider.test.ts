/** The Scene Tree view's data: a scene document's node tree as tree items. */

import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { REVEAL_SCENE_NODE_COMMAND, SceneTreeProvider } from './SceneTreeProvider';
import { sceneDocument } from './sceneTree.testkit';

/** Each node as `name: type`, indented two spaces per level of nesting. */
function outlineOf(provider: SceneTreeProvider, symbols = provider.getChildren(), depth = 0): string[] {
  return symbols.flatMap((symbol) => {
    const item = provider.getTreeItem(symbol);
    return [
      `${'  '.repeat(depth)}${item.label}: ${item.description}`,
      ...outlineOf(provider, provider.getChildren(symbol), depth + 1),
    ];
  });
}

function boxOf(provider: SceneTreeProvider): vscode.DocumentSymbol {
  return provider.getChildren()[0]!.children[0]!;
}

describe('SceneTreeProvider', () => {
  it('lists the node tree of the scene it shows', () => {
    const provider = new SceneTreeProvider();
    provider.show(sceneDocument('/workspace/main.tscn'));

    expect(outlineOf(provider)).toEqual(['Scene: Node3D', '  Box: MeshInstance3D', '    Lamp: OmniLight3D']);
  });

  it('lists nothing while no scene is shown', () => {
    const provider = new SceneTreeProvider();

    expect(provider.getChildren()).toEqual([]);
  });

  it('lists nothing for a scene that fails to parse', () => {
    const provider = new SceneTreeProvider();
    provider.show(sceneDocument('/workspace/main.tscn', '[node name="Broken'));

    expect(provider.getChildren()).toEqual([]);
  });

  it('expands a node with children and leaves a leaf flat', () => {
    const provider = new SceneTreeProvider();
    provider.show(sceneDocument('/workspace/main.tscn'));
    const box = boxOf(provider);

    expect(provider.getTreeItem(box).collapsibleState).toBe(2);
    expect(provider.getTreeItem(box.children[0]!).collapsibleState).toBe(0);
  });

  it('draws each node with the Outline icon of its symbol kind', () => {
    const provider = new SceneTreeProvider();
    provider.show(sceneDocument('/workspace/main.tscn'));
    const box = boxOf(provider);

    expect(provider.getTreeItem(box).iconPath).toEqual({ id: 'symbol-class' });
    expect(provider.getTreeItem(box.children[0]!).iconPath).toEqual({ id: 'symbol-object' });
  });

  it('reveals a clicked node at its heading line', () => {
    const provider = new SceneTreeProvider();
    const document = sceneDocument('/workspace/main.tscn');
    provider.show(document);

    expect(provider.getTreeItem(boxOf(provider)).command).toEqual({
      command: REVEAL_SCENE_NODE_COMMAND,
      title: 'Go to Node',
      arguments: [document.uri, 4],
    });
  });

  it('tells the view to redraw when it shows another scene', () => {
    const provider = new SceneTreeProvider();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    provider.show(undefined);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
