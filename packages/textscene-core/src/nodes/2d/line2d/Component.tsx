/**
 * <Line2D> draws a stroked polyline as `buildLineStroke` builds it: Godot's `LineBuilder` strip, with
 * caps, joints, a per-point `gradient`, a `width_curve` and the UVs of a `texture`, as the one
 * surface of a canvas mesh.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodeReference, useNodeResource } from '../../../resources/reading';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { storedReal } from '../../../godot/math/real';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { bakedCurveSampler } from '../../../resources/curves/curve/bakedSample';
import { CURVE } from '../../../resources/curves/curve';
import { GRADIENT } from '../../../resources/textures/gradienttexture2d';
import { CanvasMeshBody } from '../../../r3f/canvasMesh/CanvasMeshBody';
import { useCanvasMeshTexture } from '../../../r3f/canvasMesh/useCanvasMeshTexture';
import { canvasSurfaceGeometry, type CanvasSurface } from '../../../r3f/canvasMesh/canvasSurface';
import { buildLineStroke, type LineStroke } from './lineBuilder';
import { strokeGradient } from './strokeResources';
import type { Line2DProperties } from './types';

export function Line2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Line2DProperties;
  const widthCurve = useNodeResource(props.widthCurve, CURVE).value;
  const gradient = useNodeResource(props.gradient, GRADIENT).value;
  const scope = useSceneResources();
  const texture = useCanvasMeshTexture(props, { reference: useNodeReference(props.texture, scope) });
  const hasTexture = texture.state === 'ready';
  // `Size2::aspect` of the texture, and 1 without one (`line_builder.h:51`).
  const tileAspect = texture.size ? storedReal(texture.size.width / texture.size.height) : 1;

  const strokeColors = useMemo(() => gradient && strokeGradient(gradient), [gradient]);
  // Baked once per curve, not per rebuild: the bake samples the curve `bake_resolution` times.
  const widthFactorAt = useMemo(() => widthCurve && bakedCurveSampler(widthCurve), [widthCurve]);
  const {
    points,
    width,
    closed,
    jointMode,
    sharpLimit,
    roundPrecision,
    beginCapMode,
    endCapMode,
    textureMode,
  } = props;
  const geometry = useMemo(() => {
    const stroke = buildLineStroke({
      points,
      width,
      closed,
      jointMode,
      sharpLimit,
      roundPrecision,
      beginCapMode,
      endCapMode,
      gradient: strokeColors,
      widthFactorAt,
      textureMode,
      tileAspect,
    });
    return stroke && strokeGeometry(stroke, hasTexture);
  }, [
    points,
    width,
    closed,
    jointMode,
    sharpLimit,
    roundPrecision,
    beginCapMode,
    endCapMode,
    strokeColors,
    widthFactorAt,
    textureMode,
    tileAspect,
    hasTexture,
  ]);
  useDisposeOnRelease(geometry);

  // With a gradient `default_color` is ignored: the vertices carry the colour and the node's tint
  // multiplies on top (`line_builder.cpp:120-124`). Without one, `default_color` is the one array
  // colour (`line_2d.cpp:306-310`).
  const surfaces = useMemo(
    (): readonly CanvasSurface[] | null =>
      geometry && [{ geometry, arrayColor: geometry.hasAttribute('color') ? undefined : props.defaultColor }],
    [geometry, props.defaultColor]
  );

  return (
    <CanvasMeshBody node={node} props={props} texture={texture} withoutTexture="white" surfaces={surfaces}>
      {children}
    </CanvasMeshBody>
  );
}

/** The strip's geometry. Without UVs a textured line's vertices all read UV (0, 0), the top-left texel (`texture_mode` NONE). */
function strokeGeometry({ vertices, colors, uvs, indices }: LineStroke, hasTexture: boolean) {
  const textureUvs = uvs ?? (hasTexture ? new Float32Array(vertices.length) : null);
  return canvasSurfaceGeometry({ positions: vertices, uvs: textureUvs, colors, indices });
}
