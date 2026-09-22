/**
 * Modulate-cascade integration coverage complementing
 * `components/CanvasItem2D.test.tsx` (which already pins the basic
 * parent→child inherit + self_modulate isolation case). This file adds the
 * gaps: three-level composition, explicit opacity inheritance, and the
 * sRGB→linear conversion applied to a grandchild's INHERITED product (not
 * just a direct child's own-pixel product).
 */
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseNode2D } from '../nodes/base/node2d/parser';
import type { Node2DProperties } from '../nodes/base/node2d/types';
import type { TscnNode } from '../parser/types';
import { CanvasItem2D } from './components/CanvasItem2D';

const heading = { type: 'node', attributes: { type: 'Node2D', name: 'CI' } };

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function makeNode(
  name: string,
  raw: Record<string, string> = {}
): TscnNode & { properties: Node2DProperties } {
  return {
    name,
    type: 'Node2D',
    children: [],
    properties: parseNode2D({ ...heading, attributes: { ...heading.attributes, name } }, raw),
  };
}

/** `node.properties` narrowed to this suite's node type, the same cast a real Component dispatcher applies. */
function node2DProps(node: TscnNode): Node2DProperties {
  return node.properties as Node2DProperties;
}

function tintedBody(tint: { color: THREE.Color; opacity: number }) {
  return (
    <mesh>
      <planeGeometry />
      <meshBasicMaterial color={tint.color} opacity={tint.opacity} transparent />
    </mesh>
  );
}

describe('modulate cascade (3-level composition)', () => {
  it('multiplies a parent tint into a plain child with no modulate of its own', async () => {
    const parent = makeNode('Parent', { modulate: 'Color(0.5, 0.5, 0.5, 1)' });
    const child = makeNode('Child');
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={parent} props={node2DProps(parent)} body={tintedBody}>
        <CanvasItem2D node={child} props={node2DProps(child)} body={tintedBody} />
      </CanvasItem2D>
    );
    const meshes = r.scene.findAllByType('Mesh');
    const childColor = ((meshes[1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    // Child has no modulate of its own: its own-pixel product is just the
    // inherited parent modulate (0.5) converted sRGB→linear.
    expect(childColor.r).toBeCloseTo(srgbToLinear(0.5), 4);
  });

  it('composes three levels: grandchild inherits grandparent × parent × its own modulate', async () => {
    const grandparent = makeNode('GP', { modulate: 'Color(0.8, 0.8, 0.8, 1)' });
    const parent = makeNode('P', { modulate: 'Color(0.5, 0.5, 0.5, 1)' });
    const grandchild = makeNode('GC', { modulate: 'Color(0.5, 0.5, 0.5, 1)' });

    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={grandparent} props={node2DProps(grandparent)} body={tintedBody}>
        <CanvasItem2D node={parent} props={node2DProps(parent)} body={tintedBody}>
          <CanvasItem2D node={grandchild} props={node2DProps(grandchild)} body={tintedBody} />
        </CanvasItem2D>
      </CanvasItem2D>
    );

    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(3);
    const grandchildColor = ((meshes[2]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    // sRGB product across all three levels: 0.8 * 0.5 * 0.5 = 0.2, THEN
    // converted to linear (the conversion happens once, after composition).
    expect(grandchildColor.r).toBeCloseTo(srgbToLinear(0.8 * 0.5 * 0.5), 4);
  });

  it('self_modulate at an intermediate level does not leak into further descendants', async () => {
    const parent = makeNode('P', {
      modulate: 'Color(0.5, 0.5, 0.5, 1)',
      self_modulate: 'Color(0, 0, 0, 1)', // own pixels only — should not affect Child
    });
    const child = makeNode('C');
    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={parent} props={node2DProps(parent)} body={tintedBody}>
        <CanvasItem2D node={child} props={node2DProps(child)} body={tintedBody} />
      </CanvasItem2D>
    );
    const meshes = r.scene.findAllByType('Mesh');
    const parentColor = ((meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    const childColor = ((meshes[1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    expect(parentColor.r).toBeCloseTo(0, 5); // parent's own pixels: modulate × self_modulate(0)
    expect(childColor.r).toBeCloseTo(srgbToLinear(0.5), 4); // child inherits modulate only
  });

  it('composes opacity (alpha) across three levels multiplicatively', async () => {
    const grandparent = makeNode('GP', { modulate: 'Color(1, 1, 1, 0.5)' });
    const parent = makeNode('P', { modulate: 'Color(1, 1, 1, 0.5)' });
    const grandchild = makeNode('GC', { modulate: 'Color(1, 1, 1, 0.5)' });

    const r = await ReactThreeTestRenderer.create(
      <CanvasItem2D node={grandparent} props={node2DProps(grandparent)} body={tintedBody}>
        <CanvasItem2D node={parent} props={node2DProps(parent)} body={tintedBody}>
          <CanvasItem2D node={grandchild} props={node2DProps(grandchild)} body={tintedBody} />
        </CanvasItem2D>
      </CanvasItem2D>
    );

    const meshes = r.scene.findAllByType('Mesh');
    const grandchildMaterial = (meshes[2]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    // Alpha multiplies with no colour-space conversion: 0.5^3 = 0.125.
    expect(grandchildMaterial.opacity).toBeCloseTo(0.125, 5);
  });
});
