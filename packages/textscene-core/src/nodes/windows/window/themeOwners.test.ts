import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { sourcesOver } from '../../../r3f/liveSceneTree.testkit';
import '../../../r3f/nodes/index';
import { viewportThemeOwners } from './themeOwners';

function ownerNames(scene: string, path: string): string[] {
  const parsed = new TscnParser().parse(`[gd_scene format=3]\n${scene}`);
  const tree = liveTreeOf(parsed.nodes, { externalResources: [], internalResources: [], ...sourcesOver() });
  return viewportThemeOwners(tree, path).map((owner) => owner.node.name);
}

describe('viewportThemeOwners', () => {
  it('climbs each Control and Window above a window, nearest first', () => {
    const scene = `
[node name="Root" type="Control"]
[node name="Outer" type="Window" parent="."]
[node name="Box" type="VBoxContainer" parent="Outer"]
[node name="Dialog" type="Window" parent="Outer/Box"]`;
    expect(ownerNames(scene, 'Root/Outer/Box/Dialog')).toEqual(['Box', 'Outer', 'Root']);
  });

  it('stops at a node that owns no theme', () => {
    const scene = `
[node name="Root" type="Control"]
[node name="Plain" type="Node" parent="."]
[node name="Dialog" type="Window" parent="Plain"]`;
    expect(ownerNames(scene, 'Root/Plain/Dialog')).toEqual([]);
  });

  it('stops at a CanvasLayer, which is neither a Control nor a Window', () => {
    const scene = `
[node name="Root" type="Control"]
[node name="Layer" type="CanvasLayer" parent="."]
[node name="Dialog" type="Window" parent="Layer"]`;
    expect(ownerNames(scene, 'Root/Layer/Dialog')).toEqual([]);
  });

  it('gives a SubViewport none, as its Controls start no climb (`theme_owner.cpp`)', () => {
    const scene = `
[node name="Root" type="Control"]
[node name="Viewport" type="SubViewport" parent="."]`;
    expect(ownerNames(scene, 'Root/Viewport')).toEqual([]);
  });

  it('answers the same array while the owners stay the same, so a forest keyed on it holds', () => {
    const parsed = new TscnParser().parse(`[gd_scene format=3]
[node name="Root" type="Control"]
[node name="Dialog" type="Window" parent="."]`);
    const scope = { externalResources: [], internalResources: [] };
    // A new tree, as each live-tree load builds, over the same scene and resources.
    const treeOf = () => liveTreeOf(parsed.nodes, { ...scope, ...sourcesOver() });
    expect(viewportThemeOwners(treeOf(), 'Root/Dialog')).toBe(viewportThemeOwners(treeOf(), 'Root/Dialog'));
  });
});
