/**
 * The icon each node type registers, from the gizmo plugin that adds it in Godot 4.6.3. A type keeps
 * the render intent it had, since the icon is an editor chrome and not what the node draws.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import type { EditorIconName } from './editorIcons';

import '../nodes/index';

const ICON_BY_TYPE: readonly (readonly [string, EditorIconName])[] = [
  ['CPUParticles3D', 'GizmoCPUParticles3D'],
  ['GPUParticles3D', 'GizmoGPUParticles3D'],
  ['Camera3D', 'GizmoCamera3D'],
  ['Decal', 'GizmoDecal'],
  ['DirectionalLight3D', 'GizmoDirectionalLight'],
  ['OmniLight3D', 'GizmoLight'],
  ['SpotLight3D', 'GizmoSpotLight'],
  ['FogVolume', 'GizmoFogVolume'],
  ['LightmapGI', 'GizmoLightmapGI'],
  ['LightmapProbe', 'GizmoLightmapProbe'],
  ['ReflectionProbe', 'GizmoReflectionProbe'],
  ['VoxelGI', 'GizmoVoxelGI'],
  ['AudioListener3D', 'GizmoAudioListener3D'],
  ['AudioStreamPlayer3D', 'Gizmo3DSamplePlayer'],
];

/** The node of `type` that a scene file writes with the property lines `body`. */
function parsedNode(type: string, body = ''): TscnNode {
  const scene = new TscnParser().parse(`[gd_scene format=3]\n\n[node name="Node" type="${type}"]\n${body}\n`);
  return scene.nodes[0]!;
}

describe('the icon registrations', () => {
  it.each(ICON_BY_TYPE)('%s registers %s', (type, icon) => {
    expect(nodeComponentRegistry.editorIconOf(type)?.icon).toBe(icon);
  });

  it('registers an icon for exactly the 14 types the editor draws one for', () => {
    const registered = nodeComponentRegistry
      .getAllTypeNames()
      .filter((type) => nodeComponentRegistry.editorIconOf(type) !== undefined);
    expect(registered.sort()).toEqual(ICON_BY_TYPE.map(([type]) => type).sort());
  });

  it.each([
    ['LightmapProbe', 'pending'],
    ['VoxelGI', 'pending'],
    ['AudioListener3D', 'transform-only'],
  ])('keeps the render intent of %s: %s', (type, intent) => {
    expect(nodeComponentRegistry.renderIntentOf(type)).toBe(intent);
  });
});

describe('a FogVolume icon', () => {
  // The gizmo plugin adds the icon inside `if (shape != FOG_VOLUME_SHAPE_WORLD)`
  // (`fog_volume_gizmo_plugin.cpp:99-123`).
  const isDrawn = (shape: number) =>
    nodeComponentRegistry.editorIconOf('FogVolume')!.isDrawn!(parsedNode('FogVolume', `shape = ${shape}`));

  it.each([0, 1, 2, 3])('draws for shape %i', (shape) => {
    expect(isDrawn(shape)).toBe(true);
  });

  it('is not drawn for the World shape', () => {
    expect(isDrawn(4)).toBe(false);
  });
});

describe('a light icon', () => {
  // `light_3d_gizmo_plugin.cpp:150-155`: the light colour at full HSV value.
  it.each(['DirectionalLight3D', 'OmniLight3D', 'SpotLight3D'])('tints %s at full HSV value', (type) => {
    const node = parsedNode(type, 'light_color = Color(0.5, 0.25, 0.25, 1)');
    expect(nodeComponentRegistry.editorIconOf(type)!.modulate!(node)).toEqual({ r: 1, g: 0.5, b: 0.5, a: 1 });
  });

  it('tints a light with no colour written white', () => {
    expect(nodeComponentRegistry.editorIconOf('OmniLight3D')!.modulate!(parsedNode('OmniLight3D'))).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });
});
