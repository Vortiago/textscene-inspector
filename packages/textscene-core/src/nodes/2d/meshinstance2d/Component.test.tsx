/**
 * MeshInstance2D draws its mesh through the canvas: x and y with y down, the texture and the vertex
 * colour multiplied with the item's modulate, and nothing for a mesh Godot builds no surface for.
 */
import { describe, expect, it } from 'vitest';
import './index';
import {
  CANVAS_TEXTURE_REF,
  itHandsTheBodyItsCanvasTexture,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { heading, parsedNode } from '../../../parser/testing/parserKit';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { UndrawnMeshesProvider, useUndrawnMeshTypes } from '../../../r3f/contexts/UndrawnMeshesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  colouredQuadSurface,
  quad2DVerticesSurface,
  wallQuadSurfaces,
} from '../../../resources/testing/arrayMeshSurfaces';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { subResource } from '../../../testing/subResource';
import { MeshInstance2D } from './Component';
import { parseMeshInstance2D } from './parser';

const TEXTURE_PATH = 'res://marker.png';

const QUAD = subResource('QuadMesh', 'Quad', { size: 'Vector2(100, 100)' });

function arrayMesh(surface: string): TscnInternalResource {
  return subResource('ArrayMesh', 'Array', { _surfaces: `[${surface}]` });
}

function meshNode(raw: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'M',
    type: 'MeshInstance2D',
    children: [],
    properties: parseMeshInstance2D(heading('MeshInstance2D', { name: 'M' }), raw),
  };
}

function UndrawnTypes() {
  return <group name={useUndrawnMeshTypes('Root/M').join(',')} />;
}

async function render(raw: Record<string, string>, resources: TscnInternalResource[] = [QUAD]) {
  const fake = createFakeResourceLoader();
  const marker = new THREE.Texture();
  (marker as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 64 };
  fake.textures.seed(TEXTURE_PATH, marker);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={resources}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
      >
        <UndrawnMeshesProvider>
          <NodePathProvider path="Root/M">
            <MeshInstance2D node={meshNode(raw)}>
              <group name="Child" />
            </MeshInstance2D>
          </NodePathProvider>
          <UndrawnTypes />
        </UndrawnMeshesProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return renderer;
}

/** The corners of `geometry`, with -0 read as 0: `-y` of a vertex at y = 0 is -0. */
function corners(geometry: THREE.BufferGeometry): { min: number[]; max: number[] } {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  return { min: min.toArray().map((v) => v + 0), max: max.toArray().map((v) => v + 0) };
}

function drawnObjectTypes(renderer: Awaited<ReturnType<typeof render>>): string[] {
  return ['Mesh', 'Points', 'LineSegments'].filter((type) => renderer.scene.findAllByType(type).length > 0);
}

function drawn(renderer: Awaited<ReturnType<typeof render>>) {
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return { geometry: mesh.geometry, material: mesh.material as THREE.MeshBasicMaterial };
}

describe('MeshInstance2D', () => {
  it('draws nothing with no mesh, and its children still draw', async () => {
    const renderer = await render({});

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAll((node) => node.instance.name === 'Child')).toHaveLength(1);
  });

  it('draws nothing for a mesh type no slice builds, and reports it as undrawn', async () => {
    const renderer = await render({ mesh: 'SubResource("Odd")' }, [subResource('OddMesh', 'Odd')]);

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAll((node) => node.instance.name === 'OddMesh')).toHaveLength(1);
  });

  it('draws a QuadMesh with +y down the canvas, at the item', async () => {
    const { geometry } = drawn(await render({ mesh: 'SubResource("Quad")' }));

    expect(corners(geometry)).toEqual({ min: [-50, -50, 0], max: [50, 50, 0] });
  });

  it('draws a 2D-vertex ArrayMesh at its x and y, with z = 0', async () => {
    const { geometry } = drawn(
      await render({ mesh: 'SubResource("Array")' }, [arrayMesh(quad2DVerticesSurface())])
    );

    expect(corners(geometry)).toEqual({ min: [0, -100, 0], max: [100, 0, 0] });
  });

  it('culls no face, as the canvas has none to cull and the y flip reverses the winding', async () => {
    const { material } = drawn(await render({ mesh: 'SubResource("Quad")' }));

    expect(material.side).toBe(THREE.DoubleSide);
  });

  it('draws white with no texture', async () => {
    const { material } = drawn(await render({ mesh: 'SubResource("Quad")' }));

    expect(material.map).toBeNull();
    expect(material.color.toArray()).toEqual([1, 1, 1]);
  });

  it('carries the texture', async () => {
    const { material } = drawn(await render({ mesh: 'SubResource("Quad")', texture: 'ExtResource("1")' }));

    expect(material.map).not.toBeNull();
  });

  it('multiplies the item modulate into the mesh colour', async () => {
    const { material } = drawn(
      await render({ mesh: 'SubResource("Quad")', modulate: 'Color(1, 0.5, 0.25, 1)' })
    );

    expect(material.color.g).toBeCloseTo(0.214, 3);
    expect(material.color.b).toBeCloseTo(0.0508, 3);
  });

  it('carries the vertex colours of an ArrayMesh as a colour attribute', async () => {
    const { geometry, material } = drawn(
      await render({ mesh: 'SubResource("Array")' }, [arrayMesh(colouredQuadSurface())])
    );

    expect(geometry.getAttribute('color').itemSize).toBe(4);
    expect(material.vertexColors).toBe(true);
  });

  it('reads no vertex colour from a mesh without one', async () => {
    const { geometry, material } = drawn(await render({ mesh: 'SubResource("Quad")' }));

    expect(geometry.hasAttribute('color')).toBe(false);
    expect(material.vertexColors).toBe(false);
  });
});

describe('MeshInstance2D under a particles_animation material', () => {
  const FLIPBOOK = subResource('CanvasItemMaterial', 'Flip', {
    particles_animation: 'true',
    particles_anim_h_frames: '2',
    particles_anim_v_frames: '1',
  });

  it('shrinks to one cell and shows cell 0, for it has no custom data (canvas.glsl:139)', async () => {
    const { geometry } = drawn(
      await render({ mesh: 'SubResource("Quad")', material: 'SubResource("Flip")' }, [QUAD, FLIPBOOK])
    );

    expect(corners(geometry)).toEqual({ min: [-25, -50, 0], max: [25, 50, 0] });
    const u = Array.from(geometry.getAttribute('uv').array).filter((_, i) => i % 2 === 0);
    expect([Math.min(...u), Math.max(...u)]).toEqual([0, 0.5]);
  });
});

describe('MeshInstance2D with an ArrayMesh of other primitives', () => {
  const POINTS = { primitive: 0 };
  const LINES = { primitive: 1 };
  const LINE_STRIP = { primitive: 2 };

  function drawnBy(...surfaces: { primitive: number }[]) {
    return render({ mesh: 'SubResource("Array")' }, [
      subResource('ArrayMesh', 'Array', { _surfaces: wallQuadSurfaces(...surfaces) }),
    ]);
  }

  it('draws a points surface as points', async () => {
    expect(drawnObjectTypes(await drawnBy(POINTS))).toEqual(['Points']);
  });

  it('draws a lines surface as line segments', async () => {
    expect(drawnObjectTypes(await drawnBy(LINES))).toEqual(['LineSegments']);
  });

  it('draws a line strip as line segments', async () => {
    expect(drawnObjectTypes(await drawnBy(LINE_STRIP))).toEqual(['LineSegments']);
  });

  it('draws every surface of a mesh that holds a triangle, a point and a line surface', async () => {
    expect(drawnObjectTypes(await drawnBy({ primitive: 3 }, POINTS, LINES))).toEqual([
      'Mesh',
      'Points',
      'LineSegments',
    ]);
  });
});

describe('MeshInstance2D with a CanvasTexture', () => {
  itHandsTheBodyItsCanvasTexture((wrapper: TscnInternalResource) => {
    const mesh = parsedNode(
      { type: 'MeshInstance2D', name: 'M' },
      { mesh: 'SubResource("Quad")', texture: CANVAS_TEXTURE_REF }
    );
    return renderLitItem(
      <UndrawnMeshesProvider>
        <NodePathProvider path="Root/M">
          <MeshInstance2D node={mesh} />
        </NodePathProvider>
      </UndrawnMeshesProvider>,
      [QUAD, wrapper]
    );
  });
});
