import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Polygon2D } from './Component';
import { parsePolygon2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';
import type { TscnNode } from '../../../parser/types';

function node(rawProps: Record<string, string>, name = 'Poly'): TscnNode {
  const heading: ParsedHeading = { type: 'node', attributes: { name, type: 'Polygon2D' } };
  return { name, type: 'Polygon2D', children: [], properties: parsePolygon2D(heading, rawProps) };
}

async function render(n: TscnNode) {
  return ReactThreeTestRenderer.create(<Polygon2D node={n} />);
}

describe('<Polygon2D>', () => {
  it('fills an indexed BufferGeometry holding one vertex per polygon point', async () => {
    const renderer = await render(
      node({ polygon: 'PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)' })
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    // Exactly the authored vertices, triangulated by index — vertex identity is
    // what keeps `uv` / `vertex_colors` aligned with the points Godot paired
    // them against.
    expect(geom.attributes.position!.count).toBe(4);
    expect(geom.getIndex()!.count).toBe(6);
  });

  it('negates Y so Godot +Y-down maps into the conjugated 2D frame', async () => {
    const renderer = await render(
      node({ polygon: 'PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)' })
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    // Godot y ∈ [0,100] → three y ∈ [-100, 0].
    expect(geom.boundingBox!.min.y).toBeCloseTo(-100, 5);
    expect(geom.boundingBox!.max.y).toBeCloseTo(0, 5);
    expect(geom.boundingBox!.min.x).toBeCloseTo(0, 5);
    expect(geom.boundingBox!.max.x).toBeCloseTo(100, 5);
  });

  it('applies the flat fill color with an unlit, double-sided, alpha-blended material', async () => {
    const renderer = await render(
      node({
        polygon: 'PackedVector2Array(0, 0, 10, 0, 10, 10)',
        color: 'Color(1, 0, 0, 1)',
      })
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.type).toBe('MeshBasicMaterial');
    expect(mat.color.r).toBeCloseTo(1, 5);
    expect(mat.color.g).toBe(0);
    expect(mat.color.b).toBe(0);
    expect(mat.transparent).toBe(true);
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('carries the color alpha into material opacity', async () => {
    const renderer = await render(
      node({
        polygon: 'PackedVector2Array(0, 0, 10, 0, 10, 10)',
        color: 'Color(1, 0.329412, 0.611765, 0.501961)',
      })
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.opacity).toBeCloseTo(0.501961, 5);
  });

  it('darkens the fill by the CanvasItem modulate', async () => {
    const renderer = await render(
      node({
        polygon: 'PackedVector2Array(0, 0, 10, 0, 10, 10)',
        color: 'Color(1, 1, 1, 1)',
        modulate: 'Color(0.5, 0.5, 0.5, 1)',
      })
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    // White fill × 0.5 modulate → mid-grey (well below 1, above 0).
    expect(mat.color.r).toBeGreaterThan(0);
    expect(mat.color.r).toBeLessThan(1);
  });

  it('renders no mesh for a degenerate (< 3 vertex) polygon but keeps the group', async () => {
    const renderer = await render(node({ polygon: 'PackedVector2Array(0, 0, 10, 0)' }));
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('shifts vertices by the offset', async () => {
    const renderer = await render(
      node({ polygon: 'PackedVector2Array(0, 0, 10, 0, 10, 10)', offset: 'Vector2(5, 0)' })
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    expect(geom.boundingBox!.min.x).toBeCloseTo(5, 5);
    expect(geom.boundingBox!.max.x).toBeCloseTo(15, 5);
  });
});
