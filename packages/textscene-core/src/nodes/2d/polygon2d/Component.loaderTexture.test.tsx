/**
 * One texture from the real loader, bound by a canvas consumer and by a 3D
 * material (ADR-0042). The canvas samples it clamped, a default
 * `StandardMaterial3D` samples it tiled, and the shared entry keeps the wrapping
 * the loader gave it.
 *
 * happy-dom never settles a real image load, so `TextureLoader` is replaced
 * with one that hands back a bare texture, the way `textureProcessing.test.ts`
 * does. Everything after the decode is the real `createTextureFromBuffer`.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Polygon2D } from './Component';
import { parsePolygon2D } from './parser';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createTextureFromBuffer } from '../../../resources/formats/image/textureProcessing';
import { buildStandardMaterial } from '../../../resources/materials/standardmaterial3d/build';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import type { ParsedHeading } from '../../../parser/utils';
import type { TscnNode } from '../../../parser/types';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeTextureLoader {
    load(_url: string, onLoad: (texture: InstanceType<typeof actual.Texture>) => void): void {
      onLoad(new actual.Texture());
    }
  }
  return { ...actual, TextureLoader: FakeTextureLoader };
});

const TEX = 'res://floor.png';

function node(): TscnNode {
  const heading: ParsedHeading = { type: 'node', attributes: { name: 'Poly', type: 'Polygon2D' } };
  return {
    name: 'Poly',
    type: 'Polygon2D',
    children: [],
    properties: parsePolygon2D(heading, {
      polygon: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
      texture: 'ExtResource("1")',
    }),
  };
}

async function canvasMap(entry: THREE.Texture): Promise<THREE.Texture> {
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEX, entry);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
      >
        <Polygon2D node={node()} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return (mesh.material as THREE.MeshBasicMaterial).map!;
}

describe('one loader texture, two consumers', () => {
  it('clamps on the canvas, tiles on a default material, and never mutates the entry', async () => {
    const entry = await createTextureFromBuffer(new ArrayBuffer(8), 'image/png');
    // Set after the decode so the alpha-border pass has no pixels to read.
    (entry as unknown as { image: { width: number; height: number } }).image = {
      width: 64,
      height: 64,
    };
    expect(entry.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(entry.wrapT).toBe(THREE.ClampToEdgeWrapping);

    const canvas = await canvasMap(entry);
    expect(canvas).not.toBe(entry);
    expect(canvas.source).toBe(entry.source);
    expect(canvas.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(canvas.wrapT).toBe(THREE.ClampToEdgeWrapping);

    const material = buildStandardMaterial(parseStandardMaterial3DScalars({}), {
      albedo_texture: entry,
    }) as THREE.MeshStandardMaterial;
    expect(material.map).not.toBe(entry);
    expect(material.map!.source).toBe(entry.source);
    expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
    expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);

    expect(entry.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(entry.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(entry.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});
