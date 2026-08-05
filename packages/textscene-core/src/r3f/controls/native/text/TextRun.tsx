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
import { getAscentPx } from './openSansMetrics';
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
 * atlas bitmap (whitespace, or a character outside the baked charset).
 *
 * `skew` shears each vertex around the line's BASELINE, not its top edge:
 * Godot applies its synthesized-italic `Transform2D` via FreeType's
 * `FT_Outline_Transform` (`modules/text_server_adv/text_server_adv.cpp:
 * 1318-1320`, `:3621-3623`) directly on the glyph outline `FT_Load_Glyph`
 * just loaded — that outline's own coordinate origin is the glyph's baseline
 * pen position, so the shear pivots there (every glyph on a line shares the
 * same baseline Y, so "pivot at the glyph's own origin" and "pivot at the
 * line's baseline" are the same transform). Pivoting at the line's TOP edge
 * instead (as this used to) shifts an ascender-height vertex LEFT rather than
 * right, and shifts even a baseline-touching vertex left by a whole line's
 * worth of height — for a styled run mid-paragraph (RichTextLabel's `[i]`),
 * that eats into the space that precedes the run and opens a gap that
 * shouldn't exist after it, without changing any glyph's own pen `x`.
 */
export function buildGlyphQuadArrays(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew = 0
): GlyphQuadArrays {
  const scale = fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize;
  const baselineOffsetPx = getAscentPx(fontSizePx);

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

      const baselinePx = lineTopPx + baselineOffsetPx;
      const dx = (yPx: number): number => -skew * (yPx - baselinePx);
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
  /** Forwarded to `createMsdfMaterial` — see its own doc. Omitted (2D-UI default) leaves the material's own `false`. */
  depthTest?: boolean;
  /** Forwarded to `createMsdfMaterial` — see its own doc. Omitted (2D-UI default) leaves the material's own `DoubleSide`. */
  side?: THREE.Side;
  /** Outline colour, Godot sRGB (converted to linear like `tint`) — Label3D's `outline_modulate`. Forwarded to `createMsdfMaterial`; see its own doc. */
  outlineTint?: Color;
  /** Additional dilation for a second (outline) edge, forwarded to `createMsdfMaterial`. 0 (default) disables the outline band. */
  outlineBias?: number;
  /**
   * Tags the mesh `tscnFrameExcluded`, which `frameSceneBounds.ts` skips —
   * for Label3D's own use ONLY (`LabelGlyphs.tsx`'s own doc has the
   * measurement): its real glyph geometry mounts asynchronously and, when it
   * happens to land inside `CameraFit`'s retry window, measurably grows the
   * auto-fit bounds past what Godot's own reference camera ever sees (it is
   * placed before ANY Label3D has shaped text, every time). Omitted
   * (default) for every 2D Control caller — their text is real, present
   * content with no such asynchronous-mount/framing quirk to route around.
   */
  frameExcluded?: boolean;
}

export function TextRun({
  layout,
  fontSizePx,
  tint,
  skew = 0,
  distanceBias = 0,
  clippingPlanes,
  renderOrder = 0,
  depthTest,
  side,
  outlineTint,
  outlineBias,
  frameExcluded,
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
    const outline = outlineTint ? sRGBToLinearRGB(outlineTint.r, outlineTint.g, outlineTint.b) : null;
    return createMsdfMaterial({
      map: getAtlasTexture(),
      color: { r, g, b },
      opacity: tint.a,
      pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
      distanceBias,
      clippingPlanes,
      depthTest,
      side,
      outlineColor: outline ? { r: outline[0], g: outline[1], b: outline[2] } : undefined,
      outlineOpacity: outlineTint?.a,
      outlineBias,
    });
  }, [
    tint.r,
    tint.g,
    tint.b,
    tint.a,
    distanceBias,
    clippingPlanes,
    depthTest,
    side,
    outlineTint,
    outlineBias,
  ]);

  // R3F does not dispose a geometry/material passed as a PROP (only ones it
  // created from JSX args), so both leak on every rebuild without this. Cheap
  // before anything rendered through TextRun; now one Label mounts a run per
  // line and re-shapes on every rect or font change.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      renderOrder={renderOrder}
      userData={frameExcluded ? { tscnFrameExcluded: true } : undefined}
    />
  );
}
