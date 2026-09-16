/**
 * The MSDF quad shader shared by every glyph mesh (`TextRun.tsx`): a standard
 * median-of-3 signed-distance decode against the vendored atlas
 * (`openSansAtlas.ts`), screen-space antialiased via `fwidth`, plus a
 * `distanceBias` uniform a synthesized-bold pass can push positive to
 * embolden strokes (widening the shape by shifting the zero-crossing before
 * thresholding) without re-baking the atlas, plus an optional `outline` pass
 * (a second, wider fill composited behind — see `MsdfMaterialOptions.outline`'s
 * own doc for the Godot citation and why it is two thresholds of one field
 * rather than a port of Godot's own MTSDF ring shader).
 *
 * This shader serves the 2D Control text path only. Godot's default project
 * font is NOT MSDF (`servers/text/text_server.cpp:2386`, read by
 * `scene/theme/theme_db.cpp:59`), so nothing here is a port of the path an
 * unconfigured scene actually takes; Godot's own MSDF-font branch is
 * `scene/resources/material.cpp:1639-1656`, and its TextServer carries both
 * a FreeType-bitmap and an MSDF rasteriser
 * (`modules/text_server_adv/text_server_adv.cpp`, `rasterize_bitmap` /
 * `rasterize_msdf`). The decode below is msdfgen's own standard shading
 * technique (Chlumsky, "Shape Decomposition for Multi-Channel Distance
 * Fields") against this repo's own bake.
 *
 * TONE CURVE + ENCODE — the two trailing chunks, and why a hand-written shader
 * needs both spelled out. Every built-in three material ends with
 * `<tonemapping_fragment>` then `<colorspace_fragment>`; a `ShaderMaterial`
 * inherits neither, and each omission is silent, luminance-shaped, and has a
 * fixed point at white — which is why both survived a long time here:
 *
 *   - No encode: the shader's LINEAR `uColor` is written straight into an sRGB
 *     buffer, so every glyph lands at `srgbToLinear(c)` — Godot's font colour
 *     223 rendered as 188.
 *   - No tone curve: a 3D scene tone maps, and this previewer installs Godot's
 *     own curve as `THREE.CustomToneMapping`
 *     (`resources/environment/toneMapping.ts`), which three expands PER
 *     MATERIAL, exactly where that chunk sits. Skip it and the decode and the
 *     encode simply cancel, putting the RAW authored channel in the
 *     framebuffer — measured against Godot 4.6.3 on a Label3D `modulate` of
 *     `Color(1, 1, 0.7)` under the editor preview environment's FILMIC: Godot
 *     fills rgb(255, 255, 210), this shader filled rgb(255, 255, 179), i.e.
 *     0.7 x 255 exactly. 0 and 1 are fixed points of that curve, so a tint
 *     built from those two alone shows nothing at all.
 *
 * The curve is unconditional here rather than an opt-in some 3D caller passes,
 * and this material IS the painter for 2D Control text at the bundled font —
 * the sibling `MeshBasicMaterial` painter (`canvasTextPainter.ts`'s
 * `createCanvasTextMaterial`) takes every canvas-rasterised branch. What
 * keeps the chunk inert in 2D is that the
 * 2D world canvas is mounted `flat`, i.e. `NoToneMapping`
 * (`r3f/components/Canvas2DStage/World2DCanvas.tsx` — Godot composites canvas
 * items AFTER tone mapping the 3D buffers, so authored 2D colour reaches the
 * framebuffer as written). With no curve selected three compiles this chunk
 * out entirely. So `flat` is load-bearing for text colour, not merely for
 * fills: removing it would tone-map every glyph in the 2D stage.
 *
 * Neither `tonemapping_pars_fragment` nor `colorspace_pars_fragment` belongs
 * in this source: `WebGLProgram` injects both into the fragment PREFIX (that
 * is where `toneMapping()` and `linearToOutputTexel()` come from), so a second
 * copy would be a redefinition, not a declaration.
 *
 * `clippingPlanes` is spread onto the material rather than shared by
 * reference: three.js clip planes are per-material state, and a later
 * mutation of the caller's array (say, a ScrollContainer resizing) must not
 * reach back into a material already built from an earlier snapshot of it.
 * A custom shader also has to opt IN to clipping twice over — `clipping: true`
 * on the material (so the renderer binds the `clippingPlanes` uniform at all
 * for a `ShaderMaterial`) and the four `clipping_planes_*` chunks in the
 * shader source (which is where the actual `discard` lives; a built-in
 * material gets them from its own template). Miss either and the planes are
 * accepted and then ignored, with no error anywhere.
 *
 * No `#extension GL_OES_standard_derivatives` pragma: a plain `ShaderMaterial`
 * (this is one — `isRawShaderMaterial` is never set) is ALWAYS promoted to
 * `#version 300 es` by three's own `WebGLProgram` (`RawShaderMaterial` is the
 * only opt-out), so `fwidth`/`textureSize` are core ESSL3 built-ins needing no
 * extension at all — and the directive would be actively wrong to keep: three
 * prepends real function bodies (`sRGBTransferOETF` et al., for
 * `outputColorSpace` handling) before this template's own source, so an
 * `#extension` line here no longer sits before every non-preprocessor token
 * once assembled, which ESSL3 hard-rejects ("extension directive must occur
 * before any non-preprocessor tokens"). Confirmed by rendering a real WebGL2
 * context (Chromium/SwiftShader): with the pragma present the fragment shader
 * fails to compile and every glyph mesh draws nothing, silently, in every
 * consumer of this file — caught only once a real browser (not the
 * `@react-three/test-renderer` mock GL this module's own unit tests run
 * under) attempted the first real render.
 */
import * as THREE from 'three';
import { canvasItemFacing } from '../../../canvasItemFacing';

const VERTEX = /* glsl */ `
varying vec2 vUv;
#include <clipping_planes_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDistanceBias;
uniform float uPxRange;
uniform vec3 uOutlineColor;
uniform float uOutlineOpacity;
uniform float uOutlineWidthPx;
varying vec2 vUv;
#include <clipping_planes_pars_fragment>

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

float screenPxRange() {
  vec2 unitRange = vec2(uPxRange) / vec2(textureSize(uMap, 0));
  vec2 screenTexSize = vec2(1.0) / fwidth(vUv);
  return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

void main() {
  vec3 msd = texture2D(uMap, vUv).rgb;
  float m = median(msd.r, msd.g, msd.b);
  float spr = screenPxRange();
  // \`spr * signedDistance\` is already a SCREEN-px measure (the fill
  // threshold below is exactly that, offset by half a pixel), so widening the
  // filled region by \`uOutlineWidthPx\` screen px is a plain add here --
  // done per-fragment so it tracks the actual on-screen scale, not a
  // px-range/bake-size ratio computed once in JS.
  float signedDistancePx = spr * (m - 0.5 + uDistanceBias);
  float fillCoverage = clamp(signedDistancePx + 0.5, 0.0, 1.0);
  vec3 rgb = uColor;
  float alpha = fillCoverage * uOpacity;
  if (uOutlineWidthPx > 0.0) {
    float outlineCoverage = clamp(signedDistancePx + uOutlineWidthPx + 0.5, 0.0, 1.0);
    rgb = mix(uOutlineColor, uColor, fillCoverage);
    alpha = mix(outlineCoverage * uOutlineOpacity, uOpacity, fillCoverage);
  }
  // \`clipping_planes_fragment\` reads \`diffuseColor.a\` under ALPHA_TO_COVERAGE
  // and discards outright otherwise, so the value has to exist either way.
  vec4 diffuseColor = vec4(rgb, alpha);
  #include <clipping_planes_fragment>
  gl_FragColor = diffuseColor;
  // The tone curve, then the encode — the pair, and the order, every built-in
  // three material ends with, and which a hand-written shader gets only by
  // asking. uColor is LINEAR; without the curve the decode and the encode
  // cancel and a glyph lands at its RAW authored channel, and without the
  // encode a linear value is written straight into an sRGB buffer. This
  // file's own doc has both measurements.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface MsdfMaterialOptions {
  /** The vendored Open Sans MSDF atlas (`OPEN_SANS_ATLAS_PNG_DATA_URL` loaded to a texture), or a stand-in for tests. */
  map: THREE.Texture;
  /** Tint, LINEAR rgb (convert an authored sRGB Godot colour before calling, e.g. via `sRGBToLinearRGB`). */
  color: { r: number; g: number; b: number };
  /** Tint alpha, combined with the shape's own coverage in the shader. */
  opacity: number;
  /** `OPEN_SANS_ATLAS_INFO.distanceRange` — the MSDF field's range, atlas-bake-size px. */
  pxRange: number;
  /** Synthesized-bold embolden. 0 (default) leaves the baked stroke weight untouched. */
  distanceBias?: number;
  /** Per-mesh clip planes (`controlClipping.tsx`'s hook) — spread onto the material, never shared by reference. */
  clippingPlanes?: readonly THREE.Plane[];
  /**
   * `false` (default) — every 2D-UI Control text run draws on top of its own
   * flat canvas with no notion of depth. A 3D consumer (Label3D's
   * `no_depth_test`, Godot default `false` = depth-tested) needs this on a
   * per-material basis, so it is a widened option rather than a second
   * hardcoded template.
   */
  depthTest?: boolean;
  /**
   * Omitted (default) takes `canvasItemFacing()`'s `THREE.DoubleSide` — every
   * 2D-UI Control text run is a flat quad always viewed face-on. A 3D consumer
   * (Label3D's `double_sided`) needs `FrontSide` when explicitly disabled;
   * either way the run is drawn in ONE pass, for the reason that module gives.
   */
  side?: THREE.Side;
  /**
   * A second fill pass at a distance threshold shifted OUTWARD by
   * `widthPx` screen px, composited BEHIND the normal fill — the MSDF analog
   * of Godot's `TextServer::draw_hex_code_box`-adjacent `draw_outline` (a
   * SEPARATE, larger, solid-filled glyph drawn first, `label.cpp:876-878`).
   * Godot's own MSDF outline shader
   * (`servers/rendering/renderer_rd/shaders/canvas.glsl:606-623`) instead
   * clamps against a true-signed-distance ALPHA channel (`msdf_sample.a`) to
   * draw a hollow ring — this atlas bakes plain 3-channel MSDF (`fieldType:
   * "msdf"`, not `"mtsdf"`, `openSansAtlas.ts`), which carries no such
   * channel, so this composites two MEDIAN thresholds of the SAME RGB field
   * instead (msdfgen's own documented technique for a combined fill+border
   * effect from a plain MSDF) — a filled second shape under the first, which
   * is visually identical to Godot's two separate draws for an opaque
   * outline colour. Omitted (default) draws exactly the un-outlined shader.
   */
  outline?: {
    /** LINEAR rgb, same convention as `color`. */
    color: { r: number; g: number; b: number };
    opacity: number;
    /** Screen px the fill threshold expands by. `0` is equivalent to omitting `outline` entirely. */
    widthPx: number;
  };
}

export function createMsdfMaterial(options: MsdfMaterialOptions): THREE.ShaderMaterial {
  const {
    map,
    color,
    opacity,
    pxRange,
    distanceBias = 0,
    clippingPlanes = [],
    depthTest = false,
    side,
    outline,
  } = options;
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uMap: { value: map },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      uOpacity: { value: opacity },
      uDistanceBias: { value: distanceBias },
      uPxRange: { value: pxRange },
      uOutlineColor: { value: new THREE.Vector3(outline?.color.r ?? 0, outline?.color.g ?? 0, outline?.color.b ?? 0) },
      uOutlineOpacity: { value: outline?.opacity ?? 0 },
      uOutlineWidthPx: { value: outline?.widthPx ?? 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest,
    ...canvasItemFacing(side),
    // `clipping: true` is not optional for a ShaderMaterial: `WebGLRenderer`
    // only binds the `clippingPlanes` uniform for a shader material that asks
    // for it (`( !material.isShaderMaterial && !material.isRawShaderMaterial )
    // || material.clipping === true`), so without it the planes below are
    // accepted, stored, and silently ignored at draw time.
    clipping: true,
    clippingPlanes: [...clippingPlanes],
  });
}
