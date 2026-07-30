/**
 * Merged glyph quads for one `shapeText` layout — every visible glyph across
 * every line as a SINGLE `THREE.BufferGeometry` + MSDF material, sampled from
 * the vendored Open Sans atlas.
 *
 * Geometry lives in Godot pixels, +Y down, then negates Y once per vertex to
 * land in three-local (Y-up) space — the same convention
 * `resources/tileset/tileGeometry.ts` uses for its own batched quads, applied
 * independently here since this is a sibling leaf-drawing component, not a
 * shared dependency of it.
 *
 * Line vertical placement uses `layout.linePitchPx` (Godot's own ceiling-
 * rounded ascent+descent+spacing) as each line's top, plus the atlas glyph's
 * OWN `yoffset` (offset from ITS bake-time line-top). The atlas's bake-time
 * line metrics (`OPEN_SANS_ATLAS_INFO.lineHeight`/`.base`) are a DIFFERENT
 * quantity and are deliberately not used for this — mixing the two is
 * exactly the source of the ~2px constant vertical-origin residual measured
 * against real Godot (packet P10 spike S2's FINDINGS.md). That residual is
 * left open here: closing it is Label's job (the component that owns
 * vertical alignment), not this engine's.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OPEN_SANS_ATLAS_INFO, OPEN_SANS_ATLAS_PNG_DATA_URL } from './openSansAtlas';
import { createMsdfMaterial } from './msdfMaterial';
import type { TextLayoutResult } from './textLayout';
import type { Color } from '../../../../nodes/base/node2d/types';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';

export interface GlyphQuadArrays {
  /** `Float32Array`, 3 components/vertex, 4 vertices/glyph, order TL/TR/BL/BR. */
  positions: Float32Array;
  /** `Float32Array`, 2 components/vertex, same vertex order as `positions`. */
  uvs: Float32Array;
  /** `Uint32Array`, 6 indices/glyph (two triangles). */
  indices: Uint32Array;
}

/** Atlas pixel rect (image-Y top-left, bake-size px) -> UV rect, flipY=true convention. */
function atlasUv(x: number, y: number, width: number, height: number) {
  const { scaleW, scaleH } = OPEN_SANS_ATLAS_INFO;
  return {
    u0: x / scaleW,
    u1: (x + width) / scaleW,
    vTop: 1 - y / scaleH,
    vBottom: 1 - (y + height) / scaleH,
  };
}

/**
 * Builds one merged quad set for `layout`, skipping any placement with no
 * atlas bitmap (whitespace, or a character outside the vendored ASCII set).
 * `skewPx` shears each vertex proportional to its distance below the line's
 * OWN top (a simple, parameterised synthesized-italic shear — not calibrated
 * against Godot pixels in this packet; see the module header).
 */
export function buildGlyphQuadArrays(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew = 0
): GlyphQuadArrays {
  const scale = fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize;

  let glyphCount = 0;
  for (const line of layout.lines) {
    for (const gp of line.glyphs) {
      if (gp.glyph && gp.glyph.width > 0 && gp.glyph.height > 0) glyphCount++;
    }
  }

  const positions = new Float32Array(glyphCount * 4 * 3);
  const uvs = new Float32Array(glyphCount * 4 * 2);
  const indices = new Uint32Array(glyphCount * 6);

  let quad = 0;
  layout.lines.forEach((line, lineIndex) => {
    const lineTopPx = lineIndex * layout.linePitchPx;
    for (const gp of line.glyphs) {
      const glyph = gp.glyph;
      if (!glyph || glyph.width <= 0 || glyph.height <= 0) continue;

      const leftPx = gp.x + glyph.xoffset * scale;
      const topPx = lineTopPx + glyph.yoffset * scale;
      const rightPx = leftPx + glyph.width * scale;
      const bottomPx = topPx + glyph.height * scale;

      const dx = (yPx: number): number => -skew * (yPx - lineTopPx);
      const tl: [number, number] = [leftPx + dx(topPx), topPx];
      const tr: [number, number] = [rightPx + dx(topPx), topPx];
      const bl: [number, number] = [leftPx + dx(bottomPx), bottomPx];
      const br: [number, number] = [rightPx + dx(bottomPx), bottomPx];

      const v = quad * 4;
      positions.set(
        [tl[0], -tl[1], 0, tr[0], -tr[1], 0, bl[0], -bl[1], 0, br[0], -br[1], 0],
        v * 3
      );

      const uv = atlasUv(glyph.x, glyph.y, glyph.width, glyph.height);
      uvs.set([uv.u0, uv.vTop, uv.u1, uv.vTop, uv.u0, uv.vBottom, uv.u1, uv.vBottom], v * 2);

      indices.set([v + 2, v + 3, v, v + 3, v + 1, v], quad * 6);
      quad++;
    }
  });

  return { positions, uvs, indices };
}

let cachedAtlasTexture: THREE.Texture | null = null;

/**
 * The atlas PNG as a texture, created once and shared by identity across
 * every `<TextRun>` (textures/materials are identity-shared, not cloned per
 * consumer — only `Object3D` needs that). MSDF channels are distance-field
 * data, not colour, so `NoColorSpace` keeps them from being gamma-decoded.
 */
function getAtlasTexture(): THREE.Texture {
  if (!cachedAtlasTexture) {
    const texture = new THREE.TextureLoader().load(OPEN_SANS_ATLAS_PNG_DATA_URL);
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    cachedAtlasTexture = texture;
  }
  return cachedAtlasTexture;
}

export interface TextRunProps {
  /** A `shapeText` result — uppercase and wrapping have already happened by the time it reaches here. */
  layout: TextLayoutResult;
  /** Must match the `fontSizePx` the layout was shaped at (atlas-bake-size geometry scales by `fontSizePx / 42`). */
  fontSizePx: number;
  /** Godot colour, sRGB; `.a` is opacity, `.r/.g/.b` are converted to linear for the shader. */
  tint: Color;
  /** Synthesized-italic shear. 0 (default) draws upright. */
  skew?: number;
  /** Synthesized-bold embolden, forwarded to the material. 0 (default) is the baked stroke weight. */
  distanceBias?: number;
  /**
   * Paint order for this run's mesh. A first-class prop rather than something a
   * caller arranges around it: consumers previously reached for either a
   * wrapping `<group renderOrder>` (relying on three's group-order cascade,
   * which an intermediate unset group silently resets) or an imperative
   * `traverse` — two different workarounds for one missing prop.
   */
  renderOrder?: number;
  /** Per-mesh clip planes (`controlClipping.tsx`'s hook) — forwarded to the material, per-material state. */
  clippingPlanes?: readonly THREE.Plane[];
}

export function TextRun({
  layout,
  fontSizePx,
  tint,
  skew = 0,
  distanceBias = 0,
  clippingPlanes,
  renderOrder = 0,
}: TextRunProps) {
  const geometry = useMemo(() => {
    const { positions, uvs, indices } = buildGlyphQuadArrays(layout, fontSizePx, skew);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }, [layout, fontSizePx, skew]);

  const material = useMemo(() => {
    const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    return createMsdfMaterial({
      map: getAtlasTexture(),
      color: { r, g, b },
      opacity: tint.a,
      pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
      distanceBias,
      clippingPlanes,
    });
  }, [tint.r, tint.g, tint.b, tint.a, distanceBias, clippingPlanes]);

  // R3F does not dispose a geometry/material passed as a PROP (only ones it
  // created from JSX args), so both leak on every rebuild without this. Cheap
  // before anything rendered through TextRun; now one Label mounts a run per
  // line and re-shapes on every rect or font change.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} renderOrder={renderOrder} />;
}
