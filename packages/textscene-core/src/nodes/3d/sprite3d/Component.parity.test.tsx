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
    const map = (r.scene.findByType('Mesh').instance.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.x).toBeLessThan(0);
  });

  it('double_sided=false → FrontSide material', async () => {
    const r = await render({ double_sided: 'false' });
    expect((r.scene.findByType('Mesh').instance.material as THREE.Material).side).toBe(THREE.FrontSide);
  });

  it('transparent=false → material.transparent === false', async () => {
    const r = await render({ transparent: 'false' });
    expect((r.scene.findByType('Mesh').instance.material as THREE.Material).transparent).toBe(false);
  });

  it('centered=false shifts the quad by half its size (offset origin top-left)', async () => {
    // image 100×50, pixel_size 0.01 → width 1, height 0.5; centered=false bakes a
    // +width/2, -height/2 translate into the geometry so the node origin sits at
    // the quad's top-left corner.
    const r = await render({ centered: 'false' });
    const geom = r.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    const center = geom.boundingBox!.getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(0.5, 5);
    expect(center.y).toBeCloseTo(-0.25, 5);
  });
});
