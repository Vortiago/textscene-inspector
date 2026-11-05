/**
 * MultiMeshInstance2D draws its MultiMesh's mesh once for each instance to draw, through the canvas:
 * the instance transform and colour, the visible count, and the flipbook cell of the custom data.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { subResource } from '../../../testing/subResource';
import { MultiMeshInstance2D } from './Component';
import { parseMultiMeshInstance2D } from './parser';
import {
  canvasColorSpaceOf,
  CanvasColorSpaceProvider,
  SRGB_CANVAS,
  type CanvasColorSpace,
} from '../../../r3f/canvasColorSpace';

const QUAD = subResource('QuadMesh', 'Quad', { size: 'Vector2(10, 10)' });
const FLIPBOOK = subResource('CanvasItemMaterial', 'Flip', {
  particles_animation: 'true',
  particles_anim_h_frames: '2',
  particles_anim_v_frames: '1',
  particles_anim_loop: 'false',
});

/** A 2D buffer transform at (x, y): `[xx, xy, 0, ox, yx, yy, 0, oy]`. */
const at = (x: number, y: number) => [1, 0, 0, x, 0, 1, 0, y];

function multiMesh(data: Record<string, string>): TscnInternalResource {
  return subResource('MultiMesh', 'MM', { mesh: 'SubResource("Quad")', ...data });
}

function buffer(values: number[]): string {
  return `PackedFloat32Array(${values.join(', ')})`;
}

function multiMeshNode(raw: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'M',
    type: 'MultiMeshInstance2D',
    children: [],
    properties: parseMultiMeshInstance2D(heading('MultiMeshInstance2D', { name: 'M' }), raw),
  };
}

async function render(
  raw: Record<string, string>,
  resources: TscnInternalResource[],
  space: CanvasColorSpace = SRGB_CANVAS
) {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[QUAD, FLIPBOOK, ...resources]}>
        <CanvasColorSpaceProvider value={space}>
          <MultiMeshInstance2D node={multiMeshNode(raw)}>
            <group name="Child" />
          </MultiMeshInstance2D>
        </CanvasColorSpaceProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return renderer;
}

const MULTIMESH = { multimesh: 'SubResource("MM")' };

function drawnGeometry(renderer: Awaited<ReturnType<typeof render>>): THREE.BufferGeometry {
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
}

function drawnCount(renderer: Awaited<ReturnType<typeof render>>): number {
  return renderer.scene.findAllByType('Mesh').length
    ? drawnGeometry(renderer).getAttribute('position').count / 4
    : 0;
}

/** The least and greatest x of the 4 vertices instance `instance` draws. */
function rangeOf(geometry: THREE.BufferGeometry, name: string, instance: number): [number, number] {
  const attribute = geometry.getAttribute(name);
  const xs = [0, 1, 2, 3].map((vertex) => attribute.getX(instance * 4 + vertex));
  return [Math.min(...xs), Math.max(...xs)];
}

describe('MultiMeshInstance2D draws nothing', () => {
  it('with no multimesh, and its children still draw', async () => {
    const renderer = await render({}, []);

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAll((node) => node.instance.name === 'Child')).toHaveLength(1);
  });

  it('with a MultiMesh that has no mesh', async () => {
    const bare = subResource('MultiMesh', 'MM', { instance_count: '1', buffer: buffer(at(0, 0)) });

    expect(drawnCount(await render(MULTIMESH, [bare]))).toBe(0);
  });

  it('for a 3D transform format (renderer_canvas_render_rd.cpp:2775-2777)', async () => {
    const threeD = multiMesh({
      transform_format: '1',
      instance_count: '1',
      buffer: buffer([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]),
    });

    expect(drawnCount(await render(MULTIMESH, [threeD]))).toBe(0);
  });

  it('for zero instances, and for a visible count of 0', async () => {
    const none = multiMesh({ instance_count: '0' });
    const hidden = multiMesh({ instance_count: '1', visible_instance_count: '0', buffer: buffer(at(0, 0)) });

    expect(drawnCount(await render(MULTIMESH, [none]))).toBe(0);
    expect(drawnCount(await render(MULTIMESH, [hidden]))).toBe(0);
  });
});

describe('MultiMeshInstance2D draws', () => {
  it('the mesh once for each instance, under its transform, with +y down the canvas', async () => {
    const two = multiMesh({ instance_count: '2', buffer: buffer([...at(100, 0), ...at(0, 50)]) });
    const geometry = drawnGeometry(await render(MULTIMESH, [two]));

    expect(geometry.getAttribute('position').count).toBe(8);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.toArray().map((v) => v + 0)).toEqual([-5, -55, 0]);
    expect(geometry.boundingBox!.max.toArray().map((v) => v + 0)).toEqual([105, 5, 0]);
  });

  it('only as many instances as the visible count', async () => {
    const three = multiMesh({
      instance_count: '3',
      visible_instance_count: '2',
      buffer: buffer([...at(0, 0), ...at(1, 0), ...at(2, 0)]),
    });

    expect(drawnCount(await render(MULTIMESH, [three]))).toBe(2);
  });

  it('with the instance colour as a colour attribute', async () => {
    const coloured = multiMesh({
      use_colors: 'true',
      instance_count: '1',
      buffer: buffer([...at(0, 0), 1, 0, 0, 0.5]),
    });
    const renderer = await render(MULTIMESH, [coloured]);
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;

    expect(Array.from(drawnGeometry(renderer).getAttribute('color').array.slice(0, 4))).toEqual([
      1, 0, 0, 0.5,
    ]);
    expect(material.vertexColors).toBe(true);
  });

  it('with the instance colour multiplied raw in a linear canvas (canvas.glsl:255)', async () => {
    const coloured = multiMesh({
      use_colors: 'true',
      instance_count: '1',
      buffer: buffer([...at(0, 0), 0.5, 0, 0, 1]),
    });
    const renderer = await render(MULTIMESH, [coloured], canvasColorSpaceOf(true));
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;

    expect(drawnGeometry(renderer).getAttribute('color').getX(0)).toBe(0.5);
    expect(material.defines ?? {}).toEqual({});
  });

  it('the cell of the custom z when the material animates particles', async () => {
    const sheet = multiMesh({
      use_custom_data: 'true',
      instance_count: '2',
      buffer: buffer([...at(0, 0), 0, 0, 0, 0, ...at(0, 0), 0, 0, 0.5, 0]),
    });
    const renderer = await render({ ...MULTIMESH, material: 'SubResource("Flip")' }, [sheet]);
    const geometry = drawnGeometry(renderer);

    // The quad shrinks to half its width, and its UV windows to the left, then the right cell.
    expect(rangeOf(geometry, 'uv', 0)).toEqual([0, 0.5]);
    expect(rangeOf(geometry, 'uv', 1)).toEqual([0.5, 1]);
    expect(rangeOf(geometry, 'position', 0)).toEqual([-2.5, 2.5]);
  });
});
