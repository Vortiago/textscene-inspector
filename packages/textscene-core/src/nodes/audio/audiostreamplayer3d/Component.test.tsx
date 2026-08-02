/**
 * AudioStreamPlayer3D R3F component tests.
 *
 * The component renders an editor-only gizmo, not a runtime mesh, so
 * assertions focus on: gizmo presence, userData markers, optional
 * range-sphere visibility, transform propagation, non-shadow-casting,
 * and tree passthrough.
 */

import { useEffect, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AudioStreamPlayer3D } from './Component';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import {
  SelectionProvider,
  useSelection,
} from '../../../r3f/contexts/SelectionContext';
import type { TscnNode } from '../../../parser/types';
import type { AudioStreamPlayer3DProperties } from './types';
import {
  AttenuationModel,
  DopplerTracking,
} from './types';
import { isMesh } from '../../../r3f/testing/threeNarrow';

/**
 * The speaker + range gizmos are now gated on selection. To
 * exercise the gizmo content the test scaffolding must (a) place the
 * component inside a NodePathProvider so it knows its path and (b)
 * set `selectedNodePath` to that same path through SelectionProvider.
 * Without this, the gate evaluates to false and the gizmo subtree is
 * intentionally empty.
 */
function SelectSeeder({ path }: { path: string }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

function withSelectedAudio(path: string, children: ReactNode): ReactNode {
  return (
    <SelectionProvider>
      <SelectSeeder path={path} />
      <NodePathProvider path={path}>{children}</NodePathProvider>
    </SelectionProvider>
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
    attenuation_model: AttenuationModel.ATTENUATION_INVERSE_DISTANCE,
    unit_size: 10,
    max_distance: 0,
    max_db: 3,
    attenuation_filter_cutoff_hz: 5000,
    attenuation_filter_db: -24,
    doppler_tracking: DopplerTracking.DOPPLER_TRACKING_DISABLED,
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
    name: props.name ?? 'Audio',
    type: 'AudioStreamPlayer3D',
    children: [],
    properties: props,
  };
}

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

  it('renders the speaker silhouette (at least 2 meshes for the cone + front disk) when selected (WI-UX-14)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      withSelectedAudio('Audio', <AudioStreamPlayer3D node={makeNode()} />)
    );
    // Cone + cylinder front disk = 2 mesh primitives in the gizmo body.
    // This used to be unconditional; now requires the audio node
    // to be the active selection.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(2);
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
      withSelectedAudio(
        'Audio',
        <AudioStreamPlayer3D node={makeNode({ unit_size: 25 })} />
      )
    );
    const group = renderer.scene.findAllByType('Group').find((g) => {
      const ud = g.instance.userData as { isAudioRangeSphere?: boolean };
      return ud.isAudioRangeSphere === true;
    });
    expect(group).toBeDefined();
    // Godot draws a camera-facing CIRCLE of lines at
    // `unit_size x soft_multiplier`; the default ATTENUATION_INVERSE_DISTANCE
    // multiplier is 12, so 25 x 12 = 300 — not unit_size raw.
    const line = (group!.instance as unknown as THREE.Object3D).children[0] as THREE.Line;
    const position = line.geometry.getAttribute('position');
    let max = 0;
    for (let i = 0; i < position.count; i++) {
      max = Math.max(max, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
    }
    expect(max).toBeCloseTo(300, 4);
  });

  it('positions the gizmo group at transform.origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AudioStreamPlayer3D node={makeNode({
        name: 'Positioned',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 4, y: 1, z: -2 },
        },
      })} />
    );
    const group = renderer.scene.findByProps({ name: 'Positioned' });
    expect(group.instance.position.x).toBe(4);
    expect(group.instance.position.y).toBe(1);
    expect(group.instance.position.z).toBe(-2);
  });

  it('gizmo materials use MeshBasicMaterial (non-shadow-casting) when selected (WI-UX-14)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      withSelectedAudio('Audio', <AudioStreamPlayer3D node={makeNode()} />)
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(0);
    for (const m of meshes) {
      const mesh = m.instance;
      if (!isMesh(mesh)) throw new Error(`findAllByType('Mesh') returned a ${mesh.type}`);
      const mat = mesh.material as THREE.Material;
      expect(mat.type).toBe('MeshBasicMaterial');
      // None of the meshes should cast shadows — gizmos are non-lit.
      expect(mesh.castShadow).toBe(false);
    }
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
