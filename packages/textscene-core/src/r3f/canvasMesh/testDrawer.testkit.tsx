/**
 * A canvas mesh drawer of one triangle for the `CanvasMeshBody` tests: it states its texture, tint,
 * array colour and vertex colours, and draws through the body.
 */
import { useMemo } from 'react';
import { heading } from '../../parser/testing/parserKit';
import { parseNode2D } from '../../nodes/base/node2d/parser';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { useNodeReference } from '../../resources/reading';
import { useSceneResources } from '../SceneResourcesContext';
import type { Rgba } from '../../godot/math/math';
import { CanvasMeshBody } from './CanvasMeshBody';
import { useCanvasMeshTexture } from './useCanvasMeshTexture';
import { canvasSurfaceGeometry, type CanvasVertexColors } from './canvasSurface';

export interface DrawerProps {
  texture?: string;
  withoutTexture?: 'white' | 'nothing';
  modulate?: string;
  arrayColor?: Rgba;
  vertexColors?: CanvasVertexColors | null;
}

/** A drawer of one triangle, with `vertexColors` naming what its `color` attribute holds, if any. */
export function TestDrawer({
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
