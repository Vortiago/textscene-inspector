import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node } from './Component';
import type { TscnNode } from '../../parser/types';
import type { Transform3D } from '../base/node3d/types';

const baseNode: TscnNode = {
  name: 'Root',
  type: 'Node',
  children: [],
  properties: {},
};

describe('<Node>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </Node>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('renders at the identity transform when properties.transform is absent', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node node={baseNode} />);
    const group = renderer.scene.findByProps({ name: 'Root' });
    expect(group.instance.position.x).toBe(0);
    expect(group.instance.position.y).toBe(0);
    expect(group.instance.position.z).toBe(0);
    expect(group.instance.scale.x).toBe(1);
    expect(group.instance.scale.y).toBe(1);
    expect(group.instance.scale.z).toBe(1);
  });

  /**
   * Pre-fix, instance-only nodes (no explicit `type`
   * attribute, only `name` + `instance`) were typed as the base `Node`
   * fallback in NodeRegistry. The base `Node` parser correctly captured
   * `properties.transform`, but the R3F `<Node>` component dropped it
   * before applying to the wrapping `<group>` — so the Crate
   * instance GLB in the hallway fixture rendered ~40× too big
   * (its instance's basis carried a uniform 0.025 scale).
   *
   * After the fix the component threads `properties.transform`
   * through `transformFromNode3DProperties` and applies the
   * decomposed position / rotation / scale to the wrapping group.
   */
  it('applies properties.transform when present (WI-HALL-4 — instance-node Transform3D)', async () => {
    // A representative instance transform from a real-world hallway scene.
    // basis columns encode a Y-axis ~90° rotation combined with a
    // uniform 0.025 scale; origin is the world placement (9.659, 0.059, 6.018).
    const transform: Transform3D = {
      basis_x: { x: 0.015184397, y: 0.019860366, z: -8.681242e-10 },
      basis_y: { x: 0, y: -1.0927848e-9, z: -0.025 },
      basis_z: { x: -0.019860366, y: 0.015184397, z: -6.6373107e-10 },
      origin: { x: 9.659, y: 0.059, z: 6.018 },
    };
    const node: TscnNode = {
      name: 'Crate',
      type: 'Node',
      children: [],
      properties: { name: 'Crate', transform } as Record<string, unknown>,
    };

    const renderer = await ReactThreeTestRenderer.create(<Node node={node} />);
    const group = renderer.scene.findByProps({ name: 'Crate' });

    // Origin is applied verbatim.
    expect(group.instance.position.x).toBeCloseTo(9.659, 4);
    expect(group.instance.position.y).toBeCloseTo(0.059, 4);
    expect(group.instance.position.z).toBeCloseTo(6.018, 4);

    // Each basis column's norm is the scale on that axis. For this
    // transform every column's norm is ~0.025 (uniform scale). The
    // load-bearing assertion: scale is NOT 1, which is what the bug
    // was producing (transform dropped → identity scale → GLB at full
    // size). Tolerance loose enough for the Y2K9 rotation noise.
    expect(group.instance.scale.x).toBeCloseTo(0.025, 4);
    expect(group.instance.scale.y).toBeCloseTo(0.025, 4);
    expect(group.instance.scale.z).toBeCloseTo(0.025, 4);

    // Sanity: rotation is non-zero (the basis is not aligned with
    // world axes). Without checking exact Euler angles — which depend
    // on rotation-order conventions — assert at least one axis is
    // non-trivial.
    const r = group.instance.rotation;
    expect(Math.abs(r.x) + Math.abs(r.y) + Math.abs(r.z)).toBeGreaterThan(0.1);
  });
});
