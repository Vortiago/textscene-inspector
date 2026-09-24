/**
 * <CanvasItem2D>, the shared CanvasItem ritual: the Node2D transform group,
 * z_index draw order, visibility and hierarchical modulate, read from rendered
 * three.js state.
 */
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseNode2D } from '../../nodes/base/node2d/parser';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { CanvasItem2D } from './CanvasItem2D';
import { canvasRenderOrder, layerRankOf, layerRanks } from '../canvasPaintOrder';

/** The world canvas's rank, derived rather than hardcoded: only a rank's order means anything. */
const WORLD_RANK = layerRankOf(layerRanks([]), 0);

const heading = { type: 'node', attributes: { type: 'Node2D', name: 'CI' } };

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function makeNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'CI',
    type: 'Node2D',
    children: [],
    properties: parseNode2D(heading, raw),
  };
}

/** `node.properties` narrowed to this suite's node type, the same cast a real Component dispatcher applies. */
function node2DProps(node: TscnNode): Node2DProperties {
  return node.properties as Node2DProperties;
}

describe('CanvasItem2D', () => {
  it('renders a named group carrying the conjugated Node2D transform and z_index draw order', async () => {
    const node = makeNode({ position: 'Vector2(100, 50)', rotation: '0.5', z_index: '2' });
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={node} props={node2DProps(node)} />
    );
    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.name).toBe('CI');
    expect(group.position.x).toBeCloseTo(100, 5);
    expect(group.position.y).toBeCloseTo(-50, 5); // Godot +Y down → three −Y
    // Draw order is `renderOrder`, not depth: the group stays in the z=0 plane.
    expect(group.position.z).toBeCloseTo(0, 5);
    expect(group.renderOrder).toBe(canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 2, sequence: 0 }));
    expect(group.rotation.z).toBeCloseTo(-0.5, 5); // clockwise-positive → negated
  });

  it('hides the group when visible is false', async () => {
    const node = makeNode({ visible: 'false' });
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={node} props={node2DProps(node)} />
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
      <CanvasItem2D node={parent} props={node2DProps(parent)} body={body}>
        <CanvasItem2D node={child} props={node2DProps(child)} body={body} />
      </CanvasItem2D>
    );
    const meshes = r.scene.findAllByType('Mesh');
    const parentColor = ((meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    const childColor = ((meshes[1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    expect(parentColor.r).toBeCloseTo(0, 5); // own pixels: modulate × self_modulate(0)
    expect(childColor.r).toBeCloseTo(srgbToLinear(0.5), 4); // inherits modulate, not self_modulate
  });
});
