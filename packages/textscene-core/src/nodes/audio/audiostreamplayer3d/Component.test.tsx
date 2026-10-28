/**
 * AudioStreamPlayer3D R3F component: an editor-only gizmo, not a runtime mesh. The tests cover
 * gizmo presence, userData markers, range visibility, transform propagation, no shadow casting
 * and tree passthrough.
 */

import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AudioStreamPlayer3D } from './Component';
import { GizmoScene } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import type { TscnNode } from '../../../parser/types';
import type { AudioStreamPlayer3DProperties } from './types';

import { AttenuationModel, DopplerTracking } from '../../../godot/scene/audio';

/**
 * The range and cone gizmos draw for the selected node only, so the scaffolding places the component in a
 * NodePathProvider and sets `selectedNodePath` to the same path through SelectionProvider.
 */
function withSelectedAudio(path: string, children: ReactNode, showGizmos = true): ReactNode {
  return (
    <GizmoScene nodePath={path} selectedPath={path} showGizmos={showGizmos}>
      {children}
    </GizmoScene>
  );
}

function makeNode(overrides: Partial<AudioStreamPlayer3DProperties> = {}): TscnNode {
  const props: AudioStreamPlayer3DProperties = {
    name: overrides.name ?? 'Audio',
    volume_db: 0,
    pitch_scale: 1,
    playing: false,
    autoplay: false,
    stream_paused: false,
    attenuation_model: AttenuationModel.INVERSE_DISTANCE,
    unit_size: 10,
    max_distance: 0,
    max_db: 3,
    attenuation_filter_cutoff_hz: 5000,
    attenuation_filter_db: -24,
    doppler_tracking: DopplerTracking.DISABLED,
    panning_strength: 1,
    area_mask: 1,
    emission_angle_enabled: false,
    emission_angle_degrees: 45,
    emission_angle_filter_attenuation_db: -12,
    bus: 'Master',
    max_polyphony: 1,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: props.name ?? 'Audio',
    type: 'AudioStreamPlayer3D',
    children: [],
    properties: props,
  };
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'Audio',
  drawnFor: 'selected-only',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    ReactThreeTestRenderer.create(
      <GizmoScene
        nodePath="Audio"
        selectedPath={selectedPath}
        showGizmos={showGizmos}
        instantiated={instantiated}
      >
        <AudioStreamPlayer3D node={makeNode({ emission_angle_enabled: true })} />
      </GizmoScene>
    ),
};
describeGizmoToggle('<AudioStreamPlayer3D>', GIZMO_CASE);
describeInstantiatedGizmo('<AudioStreamPlayer3D>', GIZMO_CASE);

describe('<AudioStreamPlayer3D> (WI-R3F-16 slice B)', () => {
  it('renders a gizmo group tagged userData.isAudioGizmo', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AudioStreamPlayer3D node={makeNode({ name: 'A' })} />
    );
    const group = renderer.scene.findByProps({ name: 'A' });
    const userData = group.instance.userData as { isAudioGizmo: boolean; nodeType: string };
    expect(userData.isAudioGizmo).toBe(true);
    expect(userData.nodeType).toBe('AudioStreamPlayer3D');
  });

  it('draws no speaker mesh when selected, since Godot draws the node icon instead', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      withSelectedAudio('Audio', <AudioStreamPlayer3D node={makeNode()} />)
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('does NOT render the range sphere when unit_size is the default (10)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AudioStreamPlayer3D node={makeNode({ unit_size: 10 })} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const sphere = meshes.find((m) => {
      const ud = m.instance.userData as { isAudioRangeSphere?: boolean };
      return ud.isAudioRangeSphere === true;
    });
    expect(sphere).toBeUndefined();
  });

  it('renders the range circle scaled by the attenuation model when selected (WI-UX-14)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      withSelectedAudio('Audio', <AudioStreamPlayer3D node={makeNode({ unit_size: 25 })} />)
    );
    const group = renderer.scene.findAllByType('Group').find((g) => {
      const ud = g.instance.userData as { isAudioRangeSphere?: boolean };
      return ud.isAudioRangeSphere === true;
    });
    expect(group).toBeDefined();
    // Godot draws a camera-facing circle of lines at `unit_size x soft_multiplier`, and the default
    // INVERSE_DISTANCE multiplier is 12, so 25 x 12 = 300. Traversed, not indexed: `<GizmoLine>`
    // wraps its line in a `<GizmoGroup>`.
    let line: THREE.Line | undefined;
    (group!.instance as unknown as THREE.Object3D).traverse((o) => {
      if (!line && (o as THREE.Line).isLine) line = o as THREE.Line;
    });
    const position = line!.geometry.getAttribute('position');
    let max = 0;
    for (let i = 0; i < position.count; i++) {
      max = Math.max(max, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
    }
    expect(max).toBeCloseTo(300, 4);
  });

  it('positions the gizmo group at transform.origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AudioStreamPlayer3D
        node={makeNode({
          name: 'Positioned',
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 4, y: 1, z: -2 },
          },
        })}
      />
    );
    const group = renderer.scene.findByProps({ name: 'Positioned' });
    expect(group.instance.position.x).toBe(4);
    expect(group.instance.position.y).toBe(1);
    expect(group.instance.position.z).toBe(-2);
  });

  it('passes children through alongside the gizmo', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AudioStreamPlayer3D node={makeNode({ name: 'Parent' })}>
        <mesh name="child-marker">
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial />
        </mesh>
      </AudioStreamPlayer3D>
    );
    expect(renderer.scene.findByProps({ name: 'child-marker' })).toBeDefined();
  });
});
