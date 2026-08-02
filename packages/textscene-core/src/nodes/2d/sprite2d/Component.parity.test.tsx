/**
 * Parity: Sprite2D modulate sRGB→linear, self_modulate own-pixels +
 * non-propagation, and region_rect + hframes/vframes composition.
 */
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseSprite2D } from './parser';
import { Sprite2D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Sprite2D', name: 'S' } };
const TEX = 'res://sprite.png';

function node(raw: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  return {
    name: 'S',
    type: 'Sprite2D',
    children,
    properties: parseSprite2D(heading, { texture: 'ExtResource("1")', ...raw }),
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

async function render(rootNode: TscnNode, internalResources: TscnInternalResource[] = []) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 100, height: 50 };
  fake.textures.seed(TEX, tex);
  // Direct dispatcher-free render: children nodes become nested <Sprite2D>.
  const renderNode = (n: TscnNode): ReactElement => (
    <Sprite2D node={n}>{n.children.map((c, i) => <Sprite2D key={i} node={c} />)}</Sprite2D>
  );
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={internalResources} externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}>
        {renderNode(rootNode)}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

/**
 * Narrow on three's own cross-copy flags rather than `instanceof`: the test
 * renderer resolves a different `three` module instance, so `instanceof` is
 * false even for genuine Meshes.
 */
function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as Partial<THREE.Mesh>).isMesh === true;
}

function isBasicMaterial(m: THREE.Material): m is THREE.MeshBasicMaterial {
  return (m as Partial<THREE.MeshBasicMaterial>).isMeshBasicMaterial === true;
}

/** The basic material a drawn mesh carries. */
function basicMaterial(instance: THREE.Object3D): THREE.MeshBasicMaterial {
  if (!isMesh(instance)) throw new Error('scene-graph instance is not a Mesh');
  const material = instance.material;
  if (Array.isArray(material) || !isBasicMaterial(material)) {
    throw new Error('mesh material is not a MeshBasicMaterial');
  }
  return material;
}

describe('Sprite2D parser parity', () => {
  it('self_modulate defaults to white opaque', () => {
    expect(parseSprite2D(heading, {}).self_modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
  it('parses self_modulate Color', () => {
    expect(parseSprite2D(heading, { self_modulate: 'Color(0.5, 0.25, 0, 1)' }).self_modulate).toEqual({
      r: 0.5, g: 0.25, b: 0, a: 1,
    });
  });
});

describe('Sprite2D render parity', () => {
  it('modulate is converted sRGB→linear before reaching the material', async () => {
    const r = await render(node({ modulate: 'Color(0.5, 0.5, 0.5, 1)' }));
    const color = basicMaterial(r.scene.findByType('Mesh').instance).color;
    expect(color.r).toBeCloseTo(srgbToLinear(0.5), 4); // ≈ 0.214, not 0.5
  });

  it('self_modulate multiplies onto own pixels', async () => {
    const r = await render(node({ self_modulate: 'Color(0, 0, 0, 1)' }));
    const color = basicMaterial(r.scene.findByType('Mesh').instance).color;
    expect(color.r).toBeCloseTo(0, 5);
  });

  it('self_modulate does NOT propagate to child CanvasItems', async () => {
    const child = node(); // default white modulate/self_modulate
    const parent = node({ self_modulate: 'Color(0, 0, 0, 1)' }, [child]);
    const r = await render(parent);
    const meshes = r.scene.findAllByType('Mesh');
    const parentColor = basicMaterial(meshes[0]!.instance).color;
    const childColor = basicMaterial(meshes[1]!.instance).color;
    expect(parentColor.r).toBeCloseTo(0, 5); // parent's own pixels darkened
    expect(childColor.r).toBeCloseTo(1, 5); // child unaffected by parent self_modulate
  });

  it('renders a procedural SubResource texture instead of the placeholder', async () => {
    // A GradientTexture2D (and NoiseTexture2D, same machinery) is described
    // entirely by the scene — no file exists to load, so the path-based arm
    // resolves nothing and the sprite must ride the procedural rasteriser.
    // The regression this pins: the noise golden captured an EMPTY stage.
    const internal: TscnInternalResource[] = [
      {
        id: 'Gradient_g',
        type: 'Gradient',
        data: { colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' },
      },
      {
        id: 'GradientTexture2D_t',
        type: 'GradientTexture2D',
        data: { gradient: 'SubResource("Gradient_g")', width: '8', height: '4' },
      },
    ];
    const r = await render(node({ texture: 'SubResource("GradientTexture2D_t")' }), internal);
    const material = basicMaterial(r.scene.findByType('Mesh').instance);
    expect((material.map as Partial<THREE.DataTexture> | null)?.isDataTexture).toBe(true);
  });

  it('region_rect + hframes subdivide the region (not the full image)', async () => {
    // image 100×50, region (0,0,40,20), hframes=2 → frame UV width = (40/100)/2 = 0.2;
    // quad width = 40/2 = 20.
    const r = await render(
      node({ region_enabled: 'true', region_rect: 'Rect2(0, 0, 40, 20)', hframes: '2' })
    );
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const map = (mesh.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.x).toBeCloseTo(0.2, 5);
    expect((mesh.geometry as THREE.PlaneGeometry).parameters.width).toBeCloseTo(20, 5);
  });
});
