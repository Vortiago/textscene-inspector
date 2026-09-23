/**
 * `<Label3D>`, the eagerly registered wrapper: node transform, billboard wiring,
 * `showLabels` gating and the `pixel_size` group. The lazy `LabelGlyphs` never
 * resolves under `@react-three/test-renderer`, so `LabelGlyphs.test.tsx` tests it.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { Label3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Label3DProperties } from './types';
import { AlphaCutMode, BillboardMode, HorizontalAlignment, TextureFilter } from './types';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';

function makeNode(overrides: Partial<Label3DProperties> = {}): TscnNode {
  const properties: Label3DProperties = {
    name: 'Label',
    text: 'Hello',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_ENABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    double_sided: true,
    font_size: 32,
    line_spacing: 0,
    horizontal_alignment: HorizontalAlignment.CENTER,
    no_depth_test: false,
    render_priority: 0,
    outline_render_priority: -1,
    alpha_cut: AlphaCutMode.DISABLED,
    alpha_scissor_threshold: 0.5,
    fixed_size: false,
    texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
    ...overrides,
  };
  return { name: properties.name ?? 'Label', type: 'Label3D', children: [], properties };
}

// `showLabels` gates Label3D text and defaults on (the ADR-0008 Label3D parity
// amendment).
function renderLabel(node: TscnNode) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowLabels>
      <Label3D node={node} />
    </ViewportModeProvider>
  );
}

describe('<Label3D>', () => {
  it('renders only an invisible, un-tagged group when labels are toggled off', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowLabels={false}>
        <Label3D node={makeNode()} />
      </ViewportModeProvider>
    );
    const group = renderer.scene.findByProps({ name: 'Label' });
    expect((group.instance.userData as { isLabel3D?: boolean }).isLabel3D).toBeUndefined();
  });

  it('renders a named group carrying billboardMode/isLabel3D userData when labels are toggled on', async () => {
    const renderer = await renderLabel(makeNode());
    const group = renderer.scene.findByProps({ name: 'Label' });
    expect(group.instance.type).toBe('Group');
    expect((group.instance.userData as { isLabel3D?: boolean; billboardMode?: number }).isLabel3D).toBe(true);
    expect((group.instance.userData as { billboardMode?: number }).billboardMode).toBe(
      BillboardMode.BILLBOARD_ENABLED
    );
  });

  it('positions the group at transform origin', async () => {
    const renderer = await renderLabel(
      makeNode({
        name: 'Sign',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 2, z: 0 },
        },
      })
    );
    const group = renderer.scene.findByProps({ name: 'Sign' });
    expect(group.instance.position.y).toBe(2);
  });

  it('nests a pixel_size-scaled group beneath the named group', async () => {
    const renderer = await renderLabel(makeNode({ pixel_size: 0.02 }));
    const named = renderer.scene.findByProps({ name: 'Label' });
    const scaled = named.children.find((c) => c.type === 'Group')!;
    expect((scaled.instance as THREE.Group).scale.x).toBeCloseTo(0.02, 6);
    expect((scaled.instance as THREE.Group).scale.y).toBeCloseTo(0.02, 6);
  });

  /** The proxy carries no `name`, so this finds it by its userData tag, scene-wide. */
  function findProxyMesh(renderer: Awaited<ReturnType<typeof renderLabel>>): THREE.Mesh {
    return renderer.scene.find(
      (n) => (n.instance as THREE.Mesh).userData?.tscnBoundsProxy === true
    ).instance as THREE.Mesh;
  }

  it('renders an invisible, zero-size bounds-proxy mesh at the node origin, so auto-framing sees the label before the lazy glyphs mount', async () => {
    // A point, not a text-sized box: Godot places its framing camera before
    // Label3D shapes text, so each label adds only its origin (Component.tsx).
    const renderer = await renderLabel(
      makeNode({ text: 'A somewhat long caption for this test', font_size: 32, pixel_size: 0.02 })
    );
    const mesh = findProxyMesh(renderer);
    expect(mesh.visible).toBe(false);
    const geometry = mesh.geometry as unknown as { parameters: { width: number; height: number; depth: number } };
    expect(geometry.parameters.width).toBe(0);
    expect(geometry.parameters.height).toBe(0);
    expect(geometry.parameters.depth).toBe(0);

    // A point has no extent to rotate, so it sits at the node's world position
    // inside the billboarded group.
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    expect(worldPos.length()).toBeCloseTo(0, 6);
  });

  it('the bounds-proxy point stays at the node origin even after useBillboard rotates the label group', async () => {
    // A point is rotation-invariant: rotating its group never moves it off the
    // node's position.
    const renderer = await renderLabel(
      makeNode({ billboard: BillboardMode.BILLBOARD_ENABLED, text: 'Hello' })
    );
    const billboardGroup = renderer.scene.findByProps({ name: 'Label' }).instance as THREE.Group;
    const mesh = findProxyMesh(renderer);
    const worldPosBefore = new THREE.Vector3();
    mesh.getWorldPosition(worldPosBefore);
    billboardGroup.quaternion.set(0.2, 0.3, 0.4, Math.sqrt(1 - 0.2 ** 2 - 0.3 ** 2 - 0.4 ** 2));
    billboardGroup.updateMatrixWorld(true);
    const worldPosAfter = new THREE.Vector3();
    mesh.getWorldPosition(worldPosAfter);
    expect(worldPosAfter.distanceTo(worldPosBefore)).toBeCloseTo(0, 6);
  });

  it('billboard=ENABLED copies the camera quaternion onto the named group after a frame', async () => {
    const renderer = await renderLabel(makeNode({ billboard: BillboardMode.BILLBOARD_ENABLED }));
    const group = renderer.scene.findByProps({ name: 'Label' }).instance as THREE.Group;
    const qBefore = group.quaternion.clone();
    await renderer.advanceFrames(2, 16);
    const norm =
      group.quaternion.x ** 2 + group.quaternion.y ** 2 + group.quaternion.z ** 2 + group.quaternion.w ** 2;
    expect(norm).toBeCloseTo(1, 4);
    expect(qBefore.length()).toBeCloseTo(1, 4);
  });

  it('billboard=DISABLED leaves the named group rotation untouched across frames', async () => {
    const renderer = await renderLabel(
      makeNode({
        billboard: BillboardMode.BILLBOARD_DISABLED,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 0 },
        },
      })
    );
    const group = renderer.scene.findByProps({ name: 'Label' }).instance as THREE.Group;
    const qBefore = group.quaternion.clone();
    await renderer.advanceFrames(2, 16);
    expect(group.quaternion.x).toBeCloseTo(qBefore.x, 6);
    expect(group.quaternion.y).toBeCloseTo(qBefore.y, 6);
    expect(group.quaternion.z).toBeCloseTo(qBefore.z, 6);
    expect(group.quaternion.w).toBeCloseTo(qBefore.w, 6);
  });

  it('renders children in a sibling group carrying the same transform, not inside the label group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowLabels>
        <Label3D node={makeNode()}>
          <mesh name="Child" />
        </Label3D>
      </ViewportModeProvider>
    );
    const child = renderer.scene.findByProps({ name: 'Child' });
    const labelGroup = renderer.scene.findByProps({ name: 'Label' });
    // The child's wrapping group is a sibling of the label group.
    expect(child.parent?.instance).not.toBe(labelGroup.instance);
  });
});
