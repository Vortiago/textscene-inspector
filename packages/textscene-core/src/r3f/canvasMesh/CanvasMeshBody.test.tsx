/**
 * `CanvasMeshBody` through a test drawer: what each texture state draws, whether the item asks the
 * light pass for a read, the material colour with and without an array colour, and the defines of
 * each kind of vertex colours in an sRGB and a linear canvas.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useMemo } from 'react';
import { heading } from '../../parser/testing/parserKit';
import { parseNode2D } from '../../nodes/base/node2d/parser';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { useNodeReference } from '../../resources/reading';
import { useSceneResources } from '../SceneResourcesContext';
import { canvasColorSpaceOf, CanvasColorSpaceProvider } from '../canvasColorSpace';
import { CANVAS_LINEAR_DEFINES, CANVAS_SRGB_DEFINES } from '../canvasSrgbMultiply';
import { godotColorToLinear } from '../godotColor';
import type { Rgba } from '../../godot/math/math';
import { CanvasMeshBody } from './CanvasMeshBody';
import { useCanvasMeshTexture } from './useCanvasMeshTexture';
import { canvasSurfaceGeometry, type CanvasVertexColors } from './canvasSurface';
import {
  placeholderMeshes,
  READY_REFERENCE,
  renderWithTexture,
  TEXTURE_REFERENCE,
  type FileLoadState,
} from './textureLoadStates.testkit';

const SRGB_CANVAS = canvasColorSpaceOf(false);
const LINEAR_CANVAS = canvasColorSpaceOf(true);

interface DrawerProps {
  texture?: string;
  withoutTexture?: 'white' | 'nothing';
  modulate?: string;
  arrayColor?: Rgba;
  vertexColors?: CanvasVertexColors | null;
}

/** A drawer of one triangle, with `vertexColors` naming what its `color` attribute holds, if any. */
function TestDrawer({
  texture: ref,
  withoutTexture = 'white',
  modulate,
  arrayColor,
  vertexColors = null,
}: DrawerProps) {
  const node = useMemo((): TscnNode => {
    const properties = parseNode2D(heading('Node2D', { name: 'Item' }), modulate ? { modulate } : {});
    return { rawProperties: {}, name: 'Item', type: 'Node2D', children: [], properties };
  }, [modulate]);
  const props = node.properties as Node2DProperties;
  const texture = useCanvasMeshTexture(props, { reference: useNodeReference(ref, useSceneResources()) });
  const surfaces = useMemo(() => {
    const geometry = canvasSurfaceGeometry({
      positions: new Float32Array([0, 0, 8, 0, 0, 8]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      colors: vertexColors ? new Float32Array(12).fill(1) : null,
    });
    return [{ geometry, arrayColor, vertexColors: vertexColors ?? undefined }];
  }, [arrayColor, vertexColors]);
  return (
    <CanvasMeshBody
      node={node}
      props={props}
      texture={texture}
      withoutTexture={withoutTexture}
      surfaces={surfaces}
    />
  );
}

async function render(props: DrawerProps, file?: FileLoadState) {
  return renderWithTexture(<TestDrawer {...props} />, file);
}

function material(renderer: Awaited<ReturnType<typeof render>>['renderer']): THREE.MeshBasicMaterial {
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
}

describe('CanvasMeshBody texture states', () => {
  it.each([
    ['white', 1],
    ['nothing', 0],
  ] as const)('with no texture and withoutTexture %s draws %i surfaces', async (withoutTexture, count) => {
    const { renderer } = await render({ withoutTexture });

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(count);
  });

  it.each(['white', 'nothing'] as const)(
    'with a ready texture and withoutTexture %s draws the mapped surface',
    async (withoutTexture) => {
      const { renderer } = await render({ texture: READY_REFERENCE, withoutTexture });

      expect(material(renderer).map).not.toBeNull();
    }
  );

  it.each(['white', 'nothing'] as const)(
    'with an arriving texture and withoutTexture %s draws nothing',
    async (withoutTexture) => {
      const { renderer } = await render({ texture: TEXTURE_REFERENCE, withoutTexture }, 'arriving');

      expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    }
  );

  it('with a failed texture and withoutTexture white draws the surface with no map', async () => {
    const { renderer } = await render({ texture: TEXTURE_REFERENCE, withoutTexture: 'white' }, 'failed');

    expect(placeholderMeshes(renderer)).toHaveLength(0);
    expect(material(renderer).map).toBeNull();
  });

  it('with a failed texture and withoutTexture nothing draws the placeholder', async () => {
    const { renderer } = await render({ texture: TEXTURE_REFERENCE, withoutTexture: 'nothing' }, 'failed');

    expect(placeholderMeshes(renderer)).toHaveLength(1);
  });
});

describe('CanvasMeshBody texture swap', () => {
  it('mounts a new material with the map when a texture is set on an item drawn without one', async () => {
    const { renderer, update } = await renderWithTexture(<TestDrawer />);
    const mapless = material(renderer);

    await update(<TestDrawer texture={READY_REFERENCE} />);

    expect(material(renderer)).not.toBe(mapless);
    expect(material(renderer).map).not.toBeNull();
  });
});

describe('CanvasMeshBody light reads', () => {
  it('asks for a light read while a surface draws', async () => {
    const { registerItem } = await render({ texture: READY_REFERENCE });

    expect(registerItem).toHaveBeenCalled();
  });

  it.each([
    ['no texture that draws nothing', { withoutTexture: 'nothing' }, undefined],
    [
      'a failed texture that draws the placeholder',
      { texture: TEXTURE_REFERENCE, withoutTexture: 'nothing' },
      'failed',
    ],
    ['an arriving texture', { texture: TEXTURE_REFERENCE }, 'arriving'],
  ] as const)('asks for none with %s', async (_case, props, file) => {
    const { registerItem } = await render(props, file);

    expect(registerItem).not.toHaveBeenCalled();
  });
});

describe('CanvasMeshBody colour', () => {
  it('draws the linear own-pixel tint without an array colour', async () => {
    const { renderer } = await render({ modulate: 'Color(0.5, 0.25, 1, 0.5)' });

    expect(material(renderer).color.getHex()).toBe(godotColorToLinear({ r: 0.5, g: 0.25, b: 1 }).getHex());
    expect(material(renderer).opacity).toBe(0.5);
  });

  it('multiplies the array colour into the tint in sRGB before the conversion', async () => {
    const arrayColor = { r: 0.5, g: 1, b: 1, a: 0.5 };
    const { renderer } = await render({ modulate: 'Color(0.5, 0.25, 1, 0.5)', arrayColor });

    expect(material(renderer).color.getHex()).toBe(godotColorToLinear({ r: 0.25, g: 0.25, b: 1 }).getHex());
    expect(material(renderer).opacity).toBe(0.25);
  });
});

describe('CanvasMeshBody defines', () => {
  async function definesIn(space: typeof SRGB_CANVAS, props: DrawerProps) {
    const { renderer } = await renderWithTexture(
      <CanvasColorSpaceProvider value={space}>
        <TestDrawer {...props} />
      </CanvasColorSpaceProvider>
    );
    return material(renderer).defines;
  }

  it.each([
    ['sRGB', 'stored', SRGB_CANVAS, CANVAS_SRGB_DEFINES],
    ['sRGB', 'instance', SRGB_CANVAS, CANVAS_SRGB_DEFINES],
    ['linear', 'stored', LINEAR_CANVAS, CANVAS_LINEAR_DEFINES],
    ['linear', 'instance', LINEAR_CANVAS, undefined],
  ] as const)(
    'in a %s canvas, %s vertex colours set their defines',
    async (_name, vertexColors, space, defines) => {
      expect(await definesIn(space, { vertexColors })).toEqual(defines);
    }
  );

  it.each([
    ['sRGB', SRGB_CANVAS, CANVAS_SRGB_DEFINES],
    ['linear', LINEAR_CANVAS, undefined],
  ] as const)(
    'in a %s canvas, a surface with no vertex colours takes the defines of its map',
    async (_name, space, defines) => {
      expect(await definesIn(space, { texture: READY_REFERENCE })).toEqual(defines);
    }
  );
});
