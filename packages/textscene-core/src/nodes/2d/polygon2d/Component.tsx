/**
 * Draws a Polygon2D as a CanvasItem2D whose body keeps one vertex per `polygon`
 * point, triangulated by index: `uv` and `vertex_colors` pair with points by
 * position, so a renumbering mesh such as `ShapeGeometry` would mismatch them.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { multiplyModulate, type CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { useCanvas2DMap } from '../../../r3f/canvas2DTextureDecode';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import type { Vector2 } from '../../base/node2d/types';
import type { Polygon2DProperties } from './types';
import { polygonRings, type PolygonRings } from './polygonShapes';
import { quantizeVertexColor, quantizeVertexColorChannel } from './vertexColorQuantize';
import { canvasItemBlendState } from '../../../resources/materials/canvasitemmaterial/renderer';
import type { CanvasItemLightingProps } from '../../../r3f/lighting2d/useCanvasItemLighting';
import {
  CanvasItemBlendMode,
  type CanvasItemMaterialProperties,
} from '../../../resources/materials/canvasitemmaterial/types';

export function Polygon2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Polygon2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  // Either an image file or an inline procedural texture; `useTexture2D` hides
  // which, and owns the lifetime of the procedural one it rasterises.
  const { texture: resolvedTexture } = useTexture2D(props.texture, externalResources, internalResources);
  const { texture, defines: decodeDefines } = useCanvas2DMap(resolvedTexture);

  const rings = useMemo(
    () =>
      polygonRings(
        props.polygon,
        props.polygons,
        props.internalVertexCount,
        props.invertEnabled,
        props.invertBorder
      ),
    [
      props.polygon,
      props.polygons,
      props.internalVertexCount,
      props.invertEnabled,
      props.invertBorder,
    ]
  );

  // Godot divides the transformed UV by the texture's pixel size, so the
  // geometry rebuilds when a late load changes the dimensions.
  const textureSize = useMemo(() => imageSize(texture), [texture]);

  const geometry = useMemo(
    () => buildPolygonGeometry(rings, props, textureSize),
    [rings, props, textureSize]
  );
  // R3F does not dispose a geometry passed through `attach`, so release it on rebuild.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint, material, lighting) =>
        geometry ? (
          <FilledPolygon
            geometry={geometry}
            tint={tint}
            color={props.color}
            texture={texture}
            vertexColors={geometry.hasAttribute('color')}
            material={material}
            lighting={lighting}
            decodeDefines={decodeDefines}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

function FilledPolygon({
  geometry,
  tint,
  color,
  texture,
  vertexColors,
  material,
  lighting,
  decodeDefines,
}: {
  geometry: THREE.BufferGeometry;
  tint: CanvasItemTint;
  color: Polygon2DProperties['color'];
  texture: THREE.Texture | null;
  vertexColors: boolean;
  material: CanvasItemMaterialProperties | null;
  lighting: CanvasItemLightingProps;
  decodeDefines: Record<string, string> | undefined;
}) {
  // Godot multiplies fill × modulate × self_modulate in sRGB, then converts once.
  // `color` is quantized first, as Godot's 8-bit mesh upload stores it
  // (`vertexColorQuantize.ts`). The inherited tint (`tint.own`) is an
  // unquantized per-draw multiply, so it composes after.
  const { fill, tintOnlyFill, opacity, tintOnlyOpacity } = useMemo(() => {
    const composed = multiplyModulate(tint.own, quantizeVertexColor(color));
    return {
      fill: godotColorToLinear(composed),
      // The same tint without the node's own `color`, for the per-vertex path
      // where Godot replaces `color` rather than combining with it.
      tintOnlyFill: godotColorToLinear(tint.own),
      opacity: composed.a,
      // `color` drops whole, alpha included, on the vertex-colour path:
      // `polygon_2d.cpp:310-314` assigns the vertex Color outright, and
      // `canvas_item_add_mesh` gets a bare `Color(1, 1, 1)` (`polygon_2d.cpp:401`).
      tintOnlyOpacity: tint.own.a,
    };
  }, [tint.own, color]);

  const blend = canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX);

  // `USE_MAP` is baked into the program source, so without
  // `materialProgramInputs` a texture resolving after the first compile would
  // never reach the shader.
  const program = materialProgramInputs({
    props: {
      // Godot's draw picks one: `vertex_colors[i]` when the sizes match, else
      // `color`. three multiplies this into vColor, so passing the fill too would
      // render `color x vertexColor`. The node tint still applies.
      color: vertexColors ? tintOnlyFill : fill,
      map: texture,
      vertexColors,
      opacity: vertexColors ? tintOnlyOpacity : opacity,
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
    },
    // The one canvas mesh where a facing split would be visible, since every
    // vertex carries its own colour and alpha. It is safe only because earcut
    // (`THREE.ShapeUtils.triangulateShape`) winds every ring one way, a property
    // `triangulateRing` does not ask for.
    merge: [canvasItemFacing(), blend, lighting],
  });

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

/** A resolved texture's pixel dimensions, or null while it has no image yet. */
function imageSize(texture: THREE.Texture | null): { width: number; height: number } | null {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height) return null;
  return { width: image.width, height: image.height };
}

/**
 * Builds the mesh from the resolved rings, or null with no fillable ring.
 * `polygons` yields independent rings, and `invert_enabled` the grown bounds with
 * the polygon as a hole. Winding is irrelevant: the material is double-sided.
 */
function buildPolygonGeometry(
  rings: PolygonRings,
  props: Polygon2DProperties,
  textureSize: { width: number; height: number } | null
): THREE.BufferGeometry | null {
  if (rings.outlines.length === 0) return null;

  // Godot's `points[i] = polygon[i] + offset`, and the UV fallback reads those
  // offset points, so the offset is folded in first.
  const points = rings.points.map((p) => ({
    x: p.x + props.offset.x,
    y: p.y + props.offset.y,
  }));

  const index: number[] = [];
  const holes = rings.hole ? [rings.hole] : [];
  for (const outline of rings.outlines) {
    triangulateRing(points, outline, holes, index);
  }
  if (index.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i]!.x;
    positions[i * 3 + 1] = -points[i]!.y;
    positions[i * 3 + 2] = 0;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);

  if (textureSize) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(buildUvs(points, props, textureSize), 2));
  }

  const colors = buildVertexColors(points.length, props.vertexColors);
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  return geometry;
}

/**
 * Godot's per-vertex UV (`polygon_2d.cpp`): `texmat.xform(uv[i] or points[i]) /
 * tex_size`, with `texmat = Transform2D(tex_rot, tex_ofs).scale(tex_scale)`.
 * `scale` scales the origin too, which the expanded form keeps visible.
 */
function buildUvs(
  points: Vector2[],
  props: Polygon2DProperties,
  textureSize: { width: number; height: number }
): Float32Array {
  const cos = Math.cos(props.textureRotation);
  const sin = Math.sin(props.textureRotation);
  const { x: sx, y: sy } = props.textureScale;
  const { x: ox, y: oy } = props.textureOffset;

  // The authored `uv` applies only when there is exactly one per vertex;
  // otherwise Godot texture-maps the point coordinates themselves.
  const authored = props.uv.length / 2 === points.length ? props.uv : null;

  const out = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const vx = authored ? authored[i * 2]! : points[i]!.x;
    const vy = authored ? authored[i * 2 + 1]! : points[i]!.y;
    out[i * 2] = (sx * (cos * vx - sin * vy + ox)) / textureSize.width;
    // Godot's texel space runs +Y down from the top-left, and three samples a
    // `flipY` texture with v = 1 at the top row. The flip comes after the whole
    // Godot-side transform, never inside it, to keep the image upright.
    out[i * 2 + 1] = 1 - (sy * (sin * vx + cos * vy + oy)) / textureSize.height;
  }
  return out;
}

/**
 * Per-vertex RGBA, only when there is exactly one per vertex: Godot falls back to
 * the flat `color` otherwise. itemSize 4 makes three define `USE_COLOR_ALPHA`, so
 * an authored alpha fade renders, where a three-wide attribute would not.
 */
function buildVertexColors(vertexCount: number, vertexColors: Float32Array): Float32Array | null {
  if (vertexCount === 0 || vertexColors.length / 4 !== vertexCount) return null;
  const out = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    // Each entry passes the same truncating 8-bit upload as the flat `color`
    // (`polygon_2d.cpp:310-314` fills the same `Vector<Color>`), so quantize
    // before the linear conversion.
    const linear = godotColorToLinear({
      r: quantizeVertexColorChannel(vertexColors[i * 4]!),
      g: quantizeVertexColorChannel(vertexColors[i * 4 + 1]!),
      b: quantizeVertexColorChannel(vertexColors[i * 4 + 2]!),
    });
    out[i * 4] = linear.r;
    out[i * 4 + 1] = linear.g;
    out[i * 4 + 2] = linear.b;
    out[i * 4 + 3] = quantizeVertexColorChannel(vertexColors[i * 4 + 3]!);
  }
  return out;
}

/**
 * Triangulate one ring (with optional holes) and append the triangles to
 * `index`, in the original point numbering. `ShapeUtils.triangulateShape`
 * returns triples indexing the contour arrays it was given, so they are mapped
 * back through the ring's own indices.
 */
function triangulateRing(
  points: Vector2[],
  outline: number[],
  holes: number[][],
  index: number[]
): void {
  const contour = outline.map((i) => new THREE.Vector2(points[i]!.x, -points[i]!.y));
  const holeContours = holes.map((hole) =>
    hole.map((i) => new THREE.Vector2(points[i]!.x, -points[i]!.y))
  );
  // The flat local numbering triangulateShape works in: contour first, then
  // each hole, in the order it concatenates them internally.
  const localToGlobal = [...outline, ...holes.flat()];
  for (const tri of THREE.ShapeUtils.triangulateShape(contour, holeContours)) {
    for (const local of tri) {
      const global = localToGlobal[local];
      if (global === undefined) return;
      index.push(global);
    }
  }
}
