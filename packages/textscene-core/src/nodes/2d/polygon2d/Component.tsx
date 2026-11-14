/**
 * Draws a Polygon2D as a canvas mesh whose one surface keeps one vertex per `polygon` point,
 * triangulated by index: `uv` and `vertex_colors` pair with points by position, so a renumbering
 * mesh such as `ShapeGeometry` would mismatch them.
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodeReference } from '../../../resources/reading';
import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import type { Polygon2DProperties } from './types';
import { polygonRings, type PolygonRings } from './polygonShapes';
import { quantizeVertexColor } from './vertexColorQuantize';
import type { Vector2 } from '../../../godot/math/vector';
import { triangulatePolygon } from '../../../godot/math/triangulate';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { useLiveScenePass } from '../../../r3f/liveScenePass';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { bindPolygonsToSkeletons, namesSkeletonToBind } from './skeletonBinding';
import { useSkeletonSkin } from './useSkeletonSkin';
import { CanvasMeshBody } from '../../../r3f/canvasMesh/CanvasMeshBody';
import { useCanvasMeshTexture } from '../../../r3f/canvasMesh/useCanvasMeshTexture';
import { canvasSurfaceGeometry, type CanvasSurface } from '../../../r3f/canvasMesh/canvasSurface';

export function Polygon2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Polygon2DProperties;

  // Either an image file or an inline procedural texture; the body hides which, and owns the
  // lifetime of the procedural one it rasterises.
  const scope = useSceneResources();
  const texture = useCanvasMeshTexture(props, { reference: useNodeReference(props.texture, scope) });

  const rings = useMemo(
    () =>
      polygonRings(
        props.polygon,
        props.polygons,
        props.internalVertexCount,
        props.invertEnabled,
        props.invertBorder
      ),
    [props.polygon, props.polygons, props.internalVertexCount, props.invertEnabled, props.invertBorder]
  );

  // Godot divides the transformed UV by the texture's size, so the geometry rebuilds when a late
  // load changes the dimensions.
  const geometry = useMemo(
    () => buildPolygonGeometry(rings, props, texture.size),
    [rings, props, texture.size]
  );
  // R3F does not dispose a geometry passed through `attach`, so release it on rebuild.
  useDisposeOnRelease(geometry);
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const nodePath = useNodePath();
  const binding = useLiveScenePass(bindPolygonsToSkeletons, namesSkeletonToBind(props) ? nodePath : null);
  useSkeletonSkin(mesh, geometry, binding);

  const surfaces = useMemo((): readonly CanvasSurface[] | null => {
    if (!geometry) return null;
    // Godot's draw picks one: `vertex_colors[i]` when the sizes match, else `color`
    // (`polygon_2d.cpp:310-314`). The vertex colours replace `color` whole, alpha included, and
    // `canvas_item_add_mesh` gets a bare `Color(1, 1, 1)` (`polygon_2d.cpp:401`). `color` is
    // quantized first, as Godot's 8-bit mesh upload stores it (`vertexColorQuantize.ts`).
    const arrayColor = geometry.hasAttribute('color') ? undefined : quantizeVertexColor(props.color);
    return [{ geometry, arrayColor, meshRef: setMesh }];
  }, [geometry, props.color]);

  return (
    <CanvasMeshBody node={node} props={props} texture={texture} withoutTexture="white" surfaces={surfaces}>
      {children}
    </CanvasMeshBody>
  );
}

/**
 * Builds the mesh from the resolved rings, or null with no fillable ring.
 * `polygons` yields independent rings, and `invert_enabled` one ring bridged to the
 * grown bounds. Winding is irrelevant: the material is double-sided.
 */
function buildPolygonGeometry(
  rings: PolygonRings,
  props: Polygon2DProperties,
  uvSpace: ImageSize | undefined
): THREE.BufferGeometry | null {
  if (rings.outlines.length === 0) return null;

  // Godot's `points[i] = polygon[i] + offset`, and the UV fallback reads those
  // offset points, so the offset is folded in first.
  const points = rings.points.map((p) => ({
    x: p.x + props.offset.x,
    y: p.y + props.offset.y,
  }));

  const index: number[] = [];
  for (const outline of rings.outlines) triangulateRing(points, outline, index);
  if (index.length === 0) return null;

  return canvasSurfaceGeometry({
    positions: Float32Array.from(points.flatMap((p) => [p.x, p.y])),
    uvs: uvSpace && buildUvs(points, props, uvSpace),
    colors: buildVertexColors(points.length, props.vertexColors),
    indices: index,
  });
}

/**
 * Godot's per-vertex UV (`polygon_2d.cpp`): `texmat.xform(uv[i] or points[i]) /
 * tex_size`, with `texmat = Transform2D(tex_rot, tex_ofs).scale(tex_scale)`.
 * `scale` scales the origin too, which the expanded form keeps visible.
 */
function buildUvs(points: Vector2[], props: Polygon2DProperties, uvSpace: ImageSize): Float64Array {
  // Godot divides by a size 0 (`polygon_2d.cpp:224-237`), and its draw samples the top-left texel.
  if (uvSpace.width === 0 || uvSpace.height === 0) return new Float64Array(points.length * 2);
  const cos = Math.cos(props.textureRotation);
  const sin = Math.sin(props.textureRotation);
  const { x: sx, y: sy } = props.textureScale;
  const { x: ox, y: oy } = props.textureOffset;

  // The authored `uv` applies only when there is exactly one per vertex;
  // otherwise Godot texture-maps the point coordinates themselves.
  const authored = props.uv.length / 2 === points.length ? props.uv : null;

  const out = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const vx = authored ? authored[i * 2]! : points[i]!.x;
    const vy = authored ? authored[i * 2 + 1]! : points[i]!.y;
    out[i * 2] = (sx * (cos * vx - sin * vy + ox)) / uvSpace.width;
    out[i * 2 + 1] = (sy * (sin * vx + cos * vy + oy)) / uvSpace.height;
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
    // (`polygon_2d.cpp:310-314` fills the same `Vector<Color>`), and stays sRGB.
    const stored = quantizeVertexColor({
      r: vertexColors[i * 4]!,
      g: vertexColors[i * 4 + 1]!,
      b: vertexColors[i * 4 + 2]!,
      a: vertexColors[i * 4 + 3]!,
    });
    out[i * 4] = stored.r;
    out[i * 4 + 1] = stored.g;
    out[i * 4 + 2] = stored.b;
    out[i * 4 + 3] = stored.a;
  }
  return out;
}

/**
 * Triangulates one ring with Godot's ear clipping (`polygon_2d.cpp:323-357`) and appends the
 * triangles to `index`, in the pool's numbering. A skeleton bends these triangles, and a ring whose
 * edges cross draws none.
 */
function triangulateRing(points: Vector2[], outline: number[], index: number[]): void {
  for (const local of triangulatePolygon(outline.map((i) => points[i]!))) index.push(outline[local]!);
}
