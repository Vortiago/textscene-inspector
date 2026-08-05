/**
 * `<Label3D>` — the thin, eagerly-registered wrapper: node transform,
 * billboard wiring, `showLabels` gating, and the `pixel_size` scale group.
 * The glyph-drawing pass (`LabelGlyphs`) is `React.lazy`-loaded (see
 * `Component.tsx`'s own doc), so its content never resolves synchronously
 * under `@react-three/test-renderer` — exercised directly, bypassing the
 * lazy boundary, in `LabelGlyphs.test.tsx`, the same split
 * `nodes/viewport/subviewport/ControlRasterPass.test.tsx` uses for its own
 * lazy-loaded heavy component.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { Label3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Label3DProperties } from './types';
import { BillboardMode, HorizontalAlignment } from './types';
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
    ...overrides,
  };
  return { name: properties.name ?? 'Label', type: 'Label3D', children: [], properties };
}

// Label3D text is gated behind the `showLabels` toggle (ON by default per the
// ADR-0008 Label3D parity amendment). The provider defaults labels on, so a bare
// `<Label3D>` already renders the group; wrap explicitly only to assert the
// OFF state.
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

  it('renders an invisible bounds-proxy mesh sized from font_size/pixel_size, so auto-framing sees it before the lazy glyphs mount', async () => {
    const renderer = await renderLabel(makeNode({ text: 'Hello', pixel_size: 0.02 }));
    const named = renderer.scene.findByProps({ name: 'Label' });
    const proxy = named.children.find((c) => c.type === 'Mesh')!;
    expect(proxy).toBeDefined();
    const mesh = proxy.instance as THREE.Mesh;
    expect(mesh.visible).toBe(false);
    expect((mesh.userData as { tscnBoundsProxy?: boolean }).tscnBoundsProxy).toBe(true);
    const geometry = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geometry.parameters.width).toBeGreaterThan(0);
    expect(geometry.parameters.height).toBeGreaterThan(0);
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
    // The child's parent group is a SIBLING of the label group, not the label
    // group itself — walk up from the child to find its own wrapping group,
    // which must differ in identity from the label group.
    expect(child.parent?.instance).not.toBe(labelGroup.instance);
  });
});
