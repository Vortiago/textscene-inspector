/**
 * <Polygon2D> — a filled convex/simple polygon in the 2D canvas. A CanvasItem2D
 * (carrying the Node2D transform + modulate ritual) whose body is a
 * `BufferGeometry` built from the `polygon` PackedVector2Array. Each Godot-local
 * vertex (px, py) is placed at three-local (px, -py) inside the conjugated
 * (diag(1,-1,1)) Node2D group, matching Sprite2D's Y-negation convention.
 *
 * The mesh keeps Godot's vertex identity: one three vertex per polygon point,
 * triangulated by index. `uv` and `vertex_colors` are paired with the polygon
 * positionally in Godot, so anything that renumbered or duplicated vertices
 * (as a generated `ShapeGeometry` does) would silently mismatch them.
 *
 * The fill is the flat `color` composited with the inherited modulate in sRGB
 * (via the tint's `own` product) and converted to linear once, then drawn with
 * an unlit, double-sided, alpha-blended material — Godot's 2D canvas model —
 * modulated by `texture` where one is set.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { multiplyModulate, type CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { resolveTexture2DPath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import type { Vector2 } from '../../base/node2d/types';
import type { Polygon2DProperties } from './types';
import { polygonRings, type PolygonRings } from './polygonShapes';
import { canvasItemBlendState } from '../../../resources/materials/canvasitemmaterial/renderer';
import {
  CanvasItemBlendMode,
  type CanvasItemMaterialProperties,
} from '../../../resources/materials/canvasitemmaterial/types';

export function Polygon2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Polygon2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  const texturePath = useMemo(
    () => resolveTexture2DPath(props.texture, externalResources, internalResources),
    [props.texture, externalResources, internalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');
  // Owned by the shared resource loader (and shared with any other node using
  // the same reference) — never disposed here.
  const texture = (texturePath ? texResult.value : null) ?? null;

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
  // geometry genuinely depends on the resolved texture: it must rebuild when a
  // late-arriving load changes the dimensions.
  const textureSize = useMemo(() => imageSize(texture), [texture]);

  const geometry = useMemo(
    () => buildPolygonGeometry(rings, props, textureSize),
    [rings, props, textureSize]
  );
  // R3F won't auto-dispose a geometry passed via `attach`; release on rebuild.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint, material) =>
        geometry ? (
          <FilledPolygon
            geometry={geometry}
            tint={tint}
            color={props.color}
            texture={texture}
            vertexColors={geometry.hasAttribute('color')}
            material={material}
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
}: {
  geometry: THREE.BufferGeometry;
  tint: CanvasItemTint;
  color: Polygon2DProperties['color'];
  texture: THREE.Texture | null;
  vertexColors: boolean;
  material: CanvasItemMaterialProperties | null;
}) {
  // Godot multiplies fill × modulate × self_modulate in one space, then converts
  // once: compose with the tint's sRGB `own` product before sRGB→linear.
  const { fill, opacity } = useMemo(() => {
    const composed = multiplyModulate(tint.own, color);
    return { fill: godotColorToLinear(composed), opacity: composed.a };
  }, [tint.own, color]);

  const blend = canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX);

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={fill}
        map={texture}
        vertexColors={vertexColors}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        {...blend}
      />
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
 * Build the filled mesh from the resolved rings: one vertex per Godot point
 * (offset applied, Y negated), triangulated by index so `uv` and
 * `vertex_colors` stay aligned with the vertices Godot authored them against.
 * No fillable ring → null.
 *
 * `polygons` yields several independent rings (Godot triangulates each on its
 * own); `invert_enabled` yields the grown bounds with the polygon as a hole.
 * Winding is irrelevant: the material is double-sided.
 */
function buildPolygonGeometry(
  rings: PolygonRings,
  props: Polygon2DProperties,
  textureSize: { width: number; height: number } | null
): THREE.BufferGeometry | null {
  if (rings.outlines.length === 0) return null;

  // Godot's `points[i] = polygon[i] + offset`, and the UV fallback reads those
  // offset points — so offset is folded in before anything else looks at them.
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
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}

/**
 * Godot's per-vertex UV, ported from `polygon_2d.cpp`:
 *
 *   Transform2D texmat(tex_rot, tex_ofs);  texmat.scale(tex_scale);
 *   uvs[i] = texmat.xform(uv.size() == points.size() ? uv[i] : points[i]) / tex_size;
 *
 * `Transform2D::scale` scales the origin along with the basis, so the offset is
 * multiplied by the scale too — expanded here rather than built as a matrix so
 * that stays visible.
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
    // Godot's texel space runs +Y DOWN from the texture's top-left; three
    // samples a `flipY` texture with v = 1 at the top row. Flipping here (after
    // the whole Godot-side transform, never inside it) is what keeps the image
    // upright — a raw pass-through renders it mirrored top-to-bottom.
    out[i * 2 + 1] = 1 - (sy * (sin * vx + cos * vy + oy)) / textureSize.height;
  }
  return out;
}

/**
 * Per-vertex colors, but only when there is exactly one per vertex — Godot
 * falls back to the flat `color` for any other length, rather than padding.
 * Alpha is dropped: the material carries one opacity, as the flat fill does.
 */
function buildVertexColors(vertexCount: number, vertexColors: Float32Array): Float32Array | null {
  if (vertexCount === 0 || vertexColors.length / 4 !== vertexCount) return null;
  const out = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const linear = godotColorToLinear({
      r: vertexColors[i * 4]!,
      g: vertexColors[i * 4 + 1]!,
      b: vertexColors[i * 4 + 2]!,
    });
    out[i * 3] = linear.r;
    out[i * 3 + 1] = linear.g;
    out[i * 3 + 2] = linear.b;
  }
  return out;
}

/**
 * Triangulate one ring (with optional holes) and append the triangles to
 * `index`, in the ORIGINAL point numbering. `ShapeUtils.triangulateShape`
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
