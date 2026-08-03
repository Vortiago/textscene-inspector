/**
 * Parity: SpriteBase3D flip/offset/centered/double_sided/transparent vs Godot.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseSprite3D } from './parser';
import { Sprite3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Sprite3D', name: 'S' } };
const TEX = 'res://sprite.png';

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'S',
    type: 'Sprite3D',
    children: [],
    properties: parseSprite3D(heading, { texture: 'ExtResource("1")', ...raw }),
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

async function render(raw: Record<string, string> = {}) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 100, height: 50 };
  fake.textures.seed(TEX, tex);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}>
        <Sprite3D node={node(raw)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('Sprite3D parser parity', () => {
  it('defaults: centered/double_sided/transparent true, flip false', () => {
    const p = parseSprite3D(heading, {});
    expect([p.centered, p.double_sided, p.transparent]).toEqual([true, true, true]);
    expect([p.flip_h, p.flip_v]).toEqual([false, false]);
  });
  it('parses flip_h/flip_v/centered/double_sided/transparent', () => {
    const p = parseSprite3D(heading, {
      flip_h: 'true', flip_v: 'true', centered: 'false', double_sided: 'false', transparent: 'false',
    });
    expect([p.flip_h, p.flip_v, p.centered, p.double_sided, p.transparent]).toEqual([
      true, true, false, false, false,
    ]);
  });
});

describe('Sprite3D render parity', () => {
  it('flip_h mirrors the texture horizontally (negative repeat.x)', async () => {
    const r = await render({ flip_h: 'true' });
    const map = ((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.x).toBeLessThan(0);
  });

  it('flip_v mirrors the texture vertically (negative repeat.y) (#18)', async () => {
    const r = await render({ flip_v: 'true' });
    const map = ((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.y).toBeLessThan(0);
  });

  it('offset displaces the quad (centered, pure offset) (#17)', async () => {
    // image 100×50, pixel_size 0.01, offset (50, 20) → geometry center at
    // +offset.x*pixel_size = 0.5, -offset.y*pixel_size = -0.2.
    const r = await render({ offset: 'Vector2(50, 20)' });
    const geom = (r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    const c = geom.boundingBox!.getCenter(new THREE.Vector3());
    expect(c.x).toBeCloseTo(0.5, 5);
    expect(c.y).toBeCloseTo(-0.2, 5);
  });

  it('modulate is converted sRGB→linear before the material (#6 parity with Sprite2D)', async () => {
    const r = await render({ modulate: 'Color(0.5, 0.5, 0.5, 1)' });
    const color = ((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color;
    expect(color.r).toBeCloseTo(srgbToLinear(0.5), 4); // ≈ 0.214, not 0.5
  });

  it('region_rect + hframes subdivide the region (compose, not exclusive) (#16 parity)', async () => {
    // image 100×50, region (0,0,40,20), hframes=2 → frame UV width (40/100)/2 = 0.2;
    // quad width = (40/2) * pixel_size 0.01 = 0.2.
    const r = await render({
      region_enabled: 'true',
      region_rect: 'Rect2(0, 0, 40, 20)',
      hframes: '2',
    });
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const map = (mesh.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.x).toBeCloseTo(0.2, 5);
    const geom = mesh.geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    const size = geom.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(0.2, 5);
  });

  it('double_sided=false → FrontSide material', async () => {
    const r = await render({ double_sided: 'false' });
    expect(((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).side).toBe(THREE.FrontSide);
  });

  it('transparent=false → material.transparent === false', async () => {
    const r = await render({ transparent: 'false' });
    expect(((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).transparent).toBe(false);
  });

  it('opaque sprite (transparent=false, alpha_cut DISABLED) writes depth', async () => {
    // An opaque quad must write depth so it sorts/occludes correctly against
    // other opaque geometry — the DISABLED alpha-cut otherwise leaves it false.
    const r = await render({ transparent: 'false' });
    expect(((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).depthWrite).toBe(true);
  });

  it('default (transparent) sprite keeps depthWrite=false on the blended path', async () => {
    const r = await render({ modulate: 'Color(1, 1, 1, 0.5)' }); // opacity < 1 → blended
    expect(((r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).depthWrite).toBe(false);
  });

  it('centered=false shifts the quad by half its size (offset origin top-left)', async () => {
    // image 100×50, pixel_size 0.01 → width 1, height 0.5; centered=false bakes a
    // +width/2, -height/2 translate into the geometry so the node origin sits at
    // the quad's top-left corner.
    const r = await render({ centered: 'false' });
    const geom = (r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    const center = geom.boundingBox!.getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(0.5, 5);
    expect(center.y).toBeCloseTo(-0.25, 5);
  });
});
