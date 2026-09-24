/**
 * The MSDF quad shader for every glyph mesh (`TextRun.tsx`): msdfgen's median-of-3
 * decode against the vendored atlas (`openSansAtlas.ts`), antialiased with `fwidth`,
 * a `distanceBias` that emboldens synthesised bold without a re-bake, and an optional
 * outline pass. It paints 2D Control text at the bundled font.
 */
// Godot's default project font is not MSDF (`servers/text/text_server.cpp:2386`,
// `scene/theme/theme_db.cpp:59`). Its MSDF branch is `scene/resources/material.cpp:1639-1656`,
// and its TextServer has both rasterisers (`modules/text_server_adv/text_server_adv.cpp`'s
// `rasterize_bitmap`/`rasterize_msdf`).
import * as THREE from 'three';
import { canvasItemFacing } from '../../../canvasItemFacing';

// No `#extension GL_OES_standard_derivatives`: three promotes a `ShaderMaterial` to
// `#version 300 es`, where `fwidth` and `textureSize` are core, and prepends function
// bodies, so the directive no longer precedes every token and ESSL3 rejects it. Under a
// real WebGL2 context the pragma failed the compile and every glyph drew nothing.

// The `clipping_planes_*` chunks hold the `discard`. A `ShaderMaterial` needs them and
// `clipping: true`, or it accepts the planes and ignores them without an error.
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

// A `ShaderMaterial` inherits neither `<tonemapping_fragment>` nor `<colorspace_fragment>`,
// so FRAGMENT ends with both. Without the encode, Godot's font colour 223 renders as 188.
// Without the curve, `Color(1, 1, 0.7)` under FILMIC fills rgb(255, 255, 179), not Godot
// 4.6.3's rgb(255, 255, 210). Both errors vanish at 0 and 1, so white text hides them.

// The curve is unconditional: the 2D canvas is mounted `flat` (`NoToneMapping`,
// `r3f/components/Canvas2DStage/World2DCanvas.tsx`), since Godot composites canvas items
// after tone mapping, so three compiles the chunk out there. Without `flat`, every
// glyph in the 2D stage would be tone-mapped.

// `WebGLProgram` injects `tonemapping_pars_fragment` and `colorspace_pars_fragment` into
// the prefix, so a copy here would be a redefinition.
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
  /** Tint, linear rgb: convert an authored sRGB Godot colour first, such as with `sRGBToLinearRGB`. */
  color: { r: number; g: number; b: number };
  /** Tint alpha, combined with the shape's own coverage in the shader. */
  opacity: number;
  /** `OPEN_SANS_ATLAS_INFO.distanceRange`: the MSDF field's range, atlas-bake-size px. */
  pxRange: number;
  /** Synthesised-bold embolden: shifts the zero-crossing outward. The default 0 keeps the baked weight. */
  distanceBias?: number;
  /** Per-mesh clip planes (`controlClipping.tsx`), copied so a later change to the caller's array cannot reach a built material. */
  clippingPlanes?: readonly THREE.Plane[];
  /**
   * `false` by default: a 2D Control text run draws on its flat canvas without
   * depth. Label3D's `no_depth_test` (Godot default `false`) sets it per material.
   */
  depthTest?: boolean;
  /**
   * Omitted, it takes `canvasItemFacing()`'s `THREE.DoubleSide` for a face-on 2D run.
   * Label3D with `double_sided` off needs `FrontSide`. Either way the run draws in one pass.
   */
  side?: THREE.Side;
  // Godot's MSDF outline (`servers/rendering/renderer_rd/shaders/canvas.glsl:606-623`)
  // reads an MTSDF alpha channel (`msdf_sample.a`) this `"msdf"` atlas lacks, so this
  // uses two median thresholds of one field, msdfgen's technique. For an opaque
  // outline colour it looks the same as Godot's two draws.
  /**
   * A second fill at a threshold `widthPx` screen px outward, composited behind
   * the fill, like Godot's larger outline glyph drawn first (`label.cpp:876-878`).
   * Omitted, the shader draws no outline.
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
    // `WebGLRenderer` binds `clippingPlanes` only when `( !material.isShaderMaterial &&
    // !material.isRawShaderMaterial ) || material.clipping === true`, and otherwise
    // ignores the planes.
    clipping: true,
    clippingPlanes: [...clippingPlanes],
  });
}
