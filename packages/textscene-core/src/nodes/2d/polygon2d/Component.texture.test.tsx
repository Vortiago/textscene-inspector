/**
 * Polygon2D's textured fill — the `texture` + `uv` mapping.
 *
 * Godot builds ONE mesh whose vertices are the polygon points and computes a UV
 * per vertex (`scene/2d/polygon_2d.cpp`, NOTIFICATION_DRAW):
 *
 *   Transform2D texmat(tex_rot, tex_ofs);
 *   texmat.scale(tex_scale);
 *   ...
 *   if (points.size() == uv.size()) uvs[i] = texmat.xform(uv[i])     / tex_size;
 *   else                            uvs[i] = texmat.xform(points[i]) / tex_size;
 *
 * with `points[i] = polygon[i] + offset`. Because `Transform2D::scale` scales
 * the origin along with the basis, that expands to
 * `uv' = tex_scale ⊙ (rot(v) + tex_ofs) / tex_size` — the scale applies to the
 * offset too, which is the part that is easy to get wrong.
 *
 * UVs are per-vertex, so the triangulation must preserve vertex identity: these
 * pin the `uv` buffer against the vertex buffer, not just its presence.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Polygon2D } from './Component';
import { parsePolygon2D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ParsedHeading } from '../../../parser/utils';
import type { TscnNode } from '../../../parser/types';

const TEX = 'res://shadow_gradient.png';
/** Deliberately non-square, so an x/y swap in the divide cannot pass. */
const TEX_W = 256;
const TEX_H = 128;

function node(rawProps: Record<string, string>): TscnNode {
  const heading: ParsedHeading = { type: 'node', attributes: { name: 'Poly', type: 'Polygon2D' } };
  return { name: 'Poly', type: 'Polygon2D', children: [], properties: parsePolygon2D(heading, rawProps) };
}

async function render(rawProps: Record<string, string>) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = {
    width: TEX_W,
    height: TEX_H,
  };
  fake.textures.seed(TEX, tex);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
      >
        <Polygon2D node={node(rawProps)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return { renderer, tex };
}

function mesh(renderer: Awaited<ReturnType<typeof render>>['renderer']): THREE.Mesh {
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

/** The `uv` attribute as (u, v) pairs. */
function uvs(geom: THREE.BufferGeometry): Array<[number, number]> {
  const attr = geom.attributes.uv!;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < attr.count; i++) out.push([attr.getX(i), attr.getY(i)]);
  return out;
}

/** The `position` attribute's (x, y) pairs — three-local, so Godot Y is negated. */
function positions(geom: THREE.BufferGeometry): Array<[number, number]> {
  const attr = geom.attributes.position!;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < attr.count; i++) out.push([attr.getX(i), attr.getY(i)]);
  return out;
}

const SQUARE = 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)';

describe('<Polygon2D> textured fill', () => {
  it('binds the resolved texture as the material map', async () => {
    const { renderer, tex } = await render({ polygon: SQUARE, texture: 'ExtResource("1")' });
    const mat = mesh(renderer).material as THREE.MeshBasicMaterial;
    // Not `toBe(tex)`: the 2D canvas gets its own `NoColorSpace`-retagged
    // clone of the shared cached texture (`useCanvas2DTexture`,
    // `canvas2DTextureDecode.ts`) so magnifying it blends undecoded sRGB
    // bytes, matching Godot's own canvas — a 3D consumer of the same path
    // must keep sampling the untouched, still-`SRGBColorSpace` original.
    // The clone shares the decoded `Source`, which is what identifies it as
    // "the same resolved texture" here.
    expect(mat.map).not.toBe(tex);
    expect(mat.map?.source).toBe(tex.source);
    expect(mat.map?.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('maps each `uv` texel to its own vertex, divided by the texture size', async () => {
    const { renderer } = await render({
      polygon: SQUARE,
      texture: 'ExtResource("1")',
      // One UV per polygon vertex, in TEXEL space as Godot stores them.
      uv: 'PackedVector2Array(0, 0, 256, 0, 256, 128, 0, 128)',
    });
    const geom = mesh(renderer).geometry;
    // Vertex identity must survive triangulation: four points in, four UVs out,
    // in the authored order.
    expect(positions(geom)).toHaveLength(4);
    // v is flipped: Godot's texel origin is the texture's TOP-left, three
    // samples a flipY texture with v = 1 there.
    expect(uvs(geom)).toEqual([
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ]);
  });

  it('falls back to the offset polygon coordinates when `uv` does not match the vertex count', async () => {
    const { renderer } = await render({
      polygon: SQUARE,
      texture: 'ExtResource("1")',
      offset: 'Vector2(32, 16)',
      uv: 'PackedVector2Array(0, 0)', // wrong length → Godot ignores it
    });
    const got = uvs(mesh(renderer).geometry);
    // points[i] = polygon[i] + offset, then / tex_size.
    expect(got[0]![0]).toBeCloseTo(32 / TEX_W, 6);
    expect(got[0]![1]).toBeCloseTo(1 - 16 / TEX_H, 6);
    expect(got[2]![0]).toBeCloseTo((64 + 32) / TEX_W, 6);
    expect(got[2]![1]).toBeCloseTo(1 - (64 + 16) / TEX_H, 6);
  });

  it('composes texture_scale over texture_offset — the scale multiplies the offset too', async () => {
    const { renderer } = await render({
      polygon: SQUARE,
      texture: 'ExtResource("1")',
      uv: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
      texture_offset: 'Vector2(10, 20)',
      texture_scale: 'Vector2(2, 3)',
    });
    const got = uvs(mesh(renderer).geometry);
    // uv' = scale ⊙ (v + offset) / tex_size, for rot = 0.
    expect(got[0]![0]).toBeCloseTo((2 * (0 + 10)) / TEX_W, 6);
    expect(got[0]![1]).toBeCloseTo(1 - (3 * (0 + 20)) / TEX_H, 6);
    expect(got[1]![0]).toBeCloseTo((2 * (64 + 10)) / TEX_W, 6);
    expect(got[1]![1]).toBeCloseTo(1 - (3 * (0 + 20)) / TEX_H, 6);
  });

  it('rotates the UV before offsetting and scaling', async () => {
    const rot = Math.PI / 2;
    const { renderer } = await render({
      polygon: SQUARE,
      texture: 'ExtResource("1")',
      uv: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
      texture_rotation: String(rot),
    });
    const got = uvs(mesh(renderer).geometry);
    // rot(64, 0) by +90° = (cos*64 - sin*0, sin*64 + cos*0) = (0, 64).
    expect(got[1]![0]).toBeCloseTo(0 / TEX_W, 5);
    expect(got[1]![1]).toBeCloseTo(1 - 64 / TEX_H, 5);
  });

  it('clamps rather than repeats — Godot canvas items default to texture_repeat disabled', async () => {
    const { renderer } = await render({ polygon: SQUARE, texture: 'ExtResource("1")' });
    const mat = mesh(renderer).material as THREE.MeshBasicMaterial;
    expect(mat.map!.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(mat.map!.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('leaves the fill untextured, and adds no uv attribute, when there is no texture', async () => {
    const { renderer } = await render({ polygon: SQUARE });
    const mat = mesh(renderer).material as THREE.MeshBasicMaterial;
    expect(mat.map).toBeNull();
  });
});

describe('<Polygon2D> vertex_colors', () => {
  it('writes one color per vertex when the count matches', async () => {
    const { renderer } = await render({
      polygon: SQUARE,
      vertex_colors: 'PackedColorArray(1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1)',
    });
    const geom = mesh(renderer).geometry;
    const color = geom.attributes.color;
    expect(color).toBeDefined();
    expect(color!.count).toBe(4);
    // Godot writes authored sRGB; the renderer converts once, as it does for
    // the flat fill. Red stays fully red in either space.
    expect(color!.getX(0)).toBeCloseTo(1, 5);
    expect(color!.getY(0)).toBeCloseTo(0, 5);
    expect((mesh(renderer).material as THREE.MeshBasicMaterial).vertexColors).toBe(true);
  });

  it('ignores a vertex_colors array whose length does not match the vertices', async () => {
    const { renderer } = await render({
      polygon: SQUARE,
      vertex_colors: 'PackedColorArray(1, 0, 0, 1)',
    });
    const geom = mesh(renderer).geometry;
    expect(geom.attributes.color).toBeUndefined();
    expect((mesh(renderer).material as THREE.MeshBasicMaterial).vertexColors).toBe(false);
  });
});
