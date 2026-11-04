/**
 * <Line2D> draws a stroked polyline as `buildLineStroke` builds it: Godot's `LineBuilder` strip, with
 * caps, joints, a per-point `gradient`, a `width_curve` and the UVs of a `texture`. The strip is
 * Y-negated into three's frame at Z = 0.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { CanvasItemPixelMaterial } from '../../../r3f/components/LitCanvasItemPixels';
import { CANVAS_SRGB_DEFINES } from '../../../r3f/canvasSrgbMultiply';
import { multiplyModulate, type CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { useCanvas2DTexture } from '../../../r3f/canvas2DTextureDecode';
import { useNode2DTextureSampler } from '../../../r3f/canvasItemTextureSampler';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { bottomUpV } from '../../../godot/math/uv';
import { storedReal } from '../../../godot/math/real';
import { useTexture2D } from '../../../resources/useTexture2D';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { bakedCurveSampler } from '../../../resources/curves/curve/bakedSample';
import { buildLineStroke, type LineStroke } from './lineBuilder';
import { strokeGradient } from './strokeResources';
import type { Line2DProperties } from './types';
import { useReferencedResources } from '../../../resources/useReferencedResources';

export function Line2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Line2DProperties;
  const { curves, gradients } = useReferencedResources([props.widthCurve], [props.gradient]);
  const widthCurve = curves[0] ?? null;
  const gradient = gradients[0] ?? null;

  const { externalResources, internalResources } = useSceneResources();
  const { texture: resolvedTexture, size } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );
  const texture = useCanvas2DTexture(resolvedTexture, useNode2DTextureSampler(props));
  // `Size2::aspect` of the texture, and 1 without one (`line_builder.h:51`).
  const hasTexture = texture !== null;
  const tileAspect = size && size.height !== 0 ? storedReal(size.width / size.height) : 1;

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
    return stroke && toGeometry(stroke, hasTexture);
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

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint, _material, pixelMaterial) =>
        geometry ? (
          <LineMesh
            geometry={geometry}
            tint={tint}
            color={props.defaultColor}
            texture={texture}
            pixelMaterial={pixelMaterial}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

function LineMesh({
  geometry,
  tint,
  color,
  texture,
  pixelMaterial,
}: {
  geometry: THREE.BufferGeometry;
  tint: CanvasItemTint;
  color: Line2DProperties['defaultColor'];
  texture: THREE.Texture | null;
  pixelMaterial: CanvasItemPixelMaterial;
}) {
  const vertexColors = geometry.hasAttribute('color');
  // With a gradient `default_color` is ignored: the vertices carry the colour and the node's tint
  // multiplies on top (`line_builder.cpp:120-124`).
  const { fill, opacity } = useMemo(() => {
    const composed = vertexColors ? tint.own : multiplyModulate(tint.own, color);
    return { fill: godotColorToLinear(composed), opacity: composed.a };
  }, [tint.own, color, vertexColors]);

  const program = materialProgramInputs({
    props: {
      color: fill,
      opacity,
      vertexColors,
      map: texture,
      transparent: true,
      depthWrite: false,
      // Godot multiplies the vertex colours and the texels as the sRGB numbers they are (`canvas.glsl:631`).
      defines: vertexColors || texture ? CANVAS_SRGB_DEFINES : undefined,
    },
    // The strip is one uniform colour or a smooth gradient, and it draws no area twice, so one pass
    // of the canvas-item facing draws it whatever its winding.
    merge: [pixelMaterial],
  });

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

/** Godot's downward Y is negated here, as for every canvas item. */
function toGeometry(
  { vertices, colors, uvs, indices }: LineStroke,
  hasTexture: boolean
): THREE.BufferGeometry {
  const positions = new Float32Array((vertices.length / 2) * 3);
  for (let i = 0; i < vertices.length / 2; i++) {
    positions[i * 3] = vertices[i * 2]!;
    positions[i * 3 + 1] = -vertices[i * 2 + 1]!;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Four wide, so three defines `USE_COLOR_ALPHA` and an authored alpha draws.
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  if (uvs || hasTexture) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(threeUvs(uvs, vertices.length / 2), 2));
  }
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Godot's texel space runs +Y down from the top-left, and three samples a texture with v = 1 at the
 * top row. Without UVs Godot's vertices all read UV (0, 0), the top-left texel (`texture_mode` NONE).
 */
function threeUvs(uvs: Float32Array | null, vertexCount: number): Float32Array {
  const out = new Float32Array(vertexCount * 2);
  for (let i = 0; i < vertexCount; i++) {
    out[i * 2] = uvs ? uvs[i * 2]! : 0;
    out[i * 2 + 1] = bottomUpV(uvs ? uvs[i * 2 + 1]! : 0);
  }
  return out;
}
