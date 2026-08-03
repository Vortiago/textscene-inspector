/**
 * <CanvasItem2D> — the shared CanvasItem ritual (Node2D transform group,
 * z_index draw order, visibility, hierarchical modulate) extracted from the
 * sprite slices. Tests assert through rendered three.js state, mirroring the
 * sprite parity suites.
 */
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseNode2D } from '../../nodes/base/node2d/parser';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import type { TscnNode } from '../../parser/types';
import { CanvasItem2D } from './CanvasItem2D';

const heading = { type: 'node', attributes: { type: 'Node2D', name: 'CI' } };

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function makeNode(
  raw: Record<string, string> = {}
): TscnNode & { properties: Node2DProperties } {
  return {
    name: 'CI',
    type: 'Node2D',
    children: [],
    properties: parseNode2D(heading, raw),
  };
}

describe('CanvasItem2D', () => {
  it('renders a named group carrying the conjugated Node2D transform and z_index draw order', async () => {
    const node = makeNode({ position: 'Vector2(100, 50)', rotation: '0.5', z_index: '2' });
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={node} props={node.properties} />
    );
    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.name).toBe('CI');
    expect(group.position.x).toBeCloseTo(100, 5);
    expect(group.position.y).toBeCloseTo(-50, 5); // Godot +Y down → three −Y
    expect(group.position.z).toBeCloseTo(0.2, 5); // z_index 2 × Z_INDEX_STEP 0.1
    expect(group.rotation.z).toBeCloseTo(-0.5, 5); // clockwise-positive → negated
  });

  it('hides the group when visible is false', async () => {
    const node = makeNode({ visible: 'false' });
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={node} props={node.properties} />
    );
    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.visible).toBe(false);
  });

  it('hands the body the linear own-pixel tint; children inherit modulate but not self_modulate', async () => {
    // Parent: modulate grey 0.5 (hierarchical), self_modulate black (own pixels only).
    const parent = makeNode({
      modulate: 'Color(0.5, 0.5, 0.5, 1)',
      self_modulate: 'Color(0, 0, 0, 1)',
    });
    const child = makeNode({});
    const body = (tint: { color: THREE.Color; opacity: number }) => (
      <mesh>
        <planeGeometry />
        <meshBasicMaterial color={tint.color} opacity={tint.opacity} transparent />
      </mesh>
    );
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={parent} props={parent.properties} body={body}>
        <CanvasItem2D node={child} props={child.properties} body={body} />
      </CanvasItem2D>
    );
    const meshes = r.scene.findAllByType('Mesh');
    const parentColor = ((meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .color;
    const childColor = ((meshes[1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .color;
    expect(parentColor.r).toBeCloseTo(0, 5); // own pixels: modulate × self_modulate(0)
    expect(childColor.r).toBeCloseTo(srgbToLinear(0.5), 4); // inherits modulate, not self_modulate
  });
});
