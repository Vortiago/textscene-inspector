/**
 * The audible-range gizmo follows Godot's editor rule, and the emission cone
 * is drawn.
 *
 * Godot's `AudioStreamPlayer3DGizmoPlugin::redraw` draws the range whenever
 * `attenuation_model != DISABLED || max_distance > 0` — it never looks at
 * `unit_size`. We suppressed it at exactly the default `unit_size` of 10, which
 * is the value nearly every corpus node carries, so the gizmo was almost always
 * absent; when it did draw, it used `unit_size` raw as the radius instead of
 * `unit_size x soft_multiplier[attenuation_model]` clamped by `max_distance`,
 * making it 3.25-12x too small.
 *
 * Multiplier table (gizmo plugin source): INVERSE_DISTANCE 12, INVERSE_SQUARE 4,
 * LOGARITHMIC 3.25, DISABLED 10000.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AudioStreamPlayer3D } from './Component';
import { parseAudioStreamPlayer3D } from './parser';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import type { TscnNode } from '../../../parser/types';

/** The gizmo is selection-gated; seed the selection to the node's own path. */
function SelectSeeder({ path }: { path: string }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

const heading = { type: 'node', attributes: { name: 'Audio', type: 'AudioStreamPlayer3D' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Audio',
    type: 'AudioStreamPlayer3D',
    children: [],
    properties: parseAudioStreamPlayer3D(heading, raw),
  };
}

/** The gizmo is selection-gated, so render it as the selected node. */
async function render(raw: Record<string, string> = {}) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <SelectSeeder path="Audio" />
      <NodePathProvider path="Audio">
        <AudioStreamPlayer3D node={node(raw)} />
      </NodePathProvider>
    </SelectionProvider>
  );
}

interface GizmoGroup {
  instance: THREE.Object3D;
}

/** Find the gizmo group carrying `flag`, or null when none is mounted. */
function gizmoGroup(
  renderer: { scene: { findAllByType: (t: string) => unknown[] } },
  flag: string
): THREE.Object3D | null {
  const groups = (renderer.scene.findAllByType('Group') as GizmoGroup[]).filter(
    (g) => g.instance.userData[flag] === true
  );
  return groups.length === 0 ? null : groups[0]!.instance;
}

/** Largest vertex distance from the gizmo's own origin, in its local space. */
function gizmoExtent(object: THREE.Object3D): number {
  const line = object.children[0] as THREE.Line;
  const position = line.geometry.getAttribute('position');
  let max = 0;
  for (let i = 0; i < position.count; i++) {
    max = Math.max(max, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
  }
  return max;
}

/** Radius of the audible-range circle, or null when no range gizmo is drawn. */
function rangeRadius(renderer: { scene: { findAllByType: (t: string) => unknown[] } }) {
  const group = gizmoGroup(renderer, 'isAudioRangeSphere');
  return group === null ? null : gizmoExtent(group);
}

describe('<AudioStreamPlayer3D> audible-range gizmo', () => {
  it('draws the range at Godot defaults — unit_size 10, inverse-distance', async () => {
    // 10 x 12 = 120, not the raw 10 we used to draw (and used to suppress).
    expect(rangeRadius(await render())).toBeCloseTo(120, 5);
  });

  it('uses the attenuation model to pick the multiplier', async () => {
    expect(rangeRadius(await render({ attenuation_model: '1' }))).toBeCloseTo(40, 5);
    expect(rangeRadius(await render({ attenuation_model: '2' }))).toBeCloseTo(32.5, 5);
  });

  it('clamps the radius to max_distance when one is set', async () => {
    expect(rangeRadius(await render({ max_distance: '25' }))).toBeCloseTo(25, 5);
  });

  it('leaves the radius alone when max_distance exceeds it', async () => {
    expect(rangeRadius(await render({ max_distance: '500' }))).toBeCloseTo(120, 5);
  });

  it('draws nothing for a DISABLED model with no max_distance', async () => {
    expect(rangeRadius(await render({ attenuation_model: '3' }))).toBeNull();
  });

  it('still draws for a DISABLED model when max_distance is set', async () => {
    expect(rangeRadius(await render({ attenuation_model: '3', max_distance: '30' }))).toBeCloseTo(
      30,
      5
    );
  });
});

describe('<AudioStreamPlayer3D> emission cone', () => {
  function coneCount(renderer: { scene: { findAllByType: (t: string) => unknown[] } }) {
    return gizmoGroup(renderer, 'isAudioEmissionCone') === null ? 0 : 1;
  }

  it('draws no emission cone by default', async () => {
    expect(coneCount(await render())).toBe(0);
  });

  it('draws one when emission_angle_enabled is set', async () => {
    expect(coneCount(await render({ emission_angle_enabled: 'true' }))).toBe(1);
  });

  it('sizes the cone from emission_angle_degrees against the range radius', async () => {
    const renderer = await render({
      emission_angle_enabled: 'true',
      emission_angle_degrees: '45',
      max_distance: '10',
    });
    // Half-angle 45deg over a 10-unit range → base radius 10 x tan(45) = 10, so
    // the far rim sits at hypot(10, 10) from the apex.
    const cone = gizmoGroup(renderer, 'isAudioEmissionCone')!;
    expect(gizmoExtent(cone)).toBeCloseTo(Math.hypot(10, 10), 4);
  });

  it('narrows the cone as emission_angle_degrees shrinks', async () => {
    const wide = gizmoExtent(
      gizmoGroup(
        await render({ emission_angle_enabled: 'true', emission_angle_degrees: '60', max_distance: '10' }),
        'isAudioEmissionCone'
      )!
    );
    const narrow = gizmoExtent(
      gizmoGroup(
        await render({ emission_angle_enabled: 'true', emission_angle_degrees: '10', max_distance: '10' }),
        'isAudioEmissionCone'
      )!
    );
    expect(narrow).toBeLessThan(wide);
  });
});
