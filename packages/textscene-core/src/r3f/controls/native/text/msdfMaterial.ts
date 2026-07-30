/**
 * The MSDF quad shader shared by every glyph mesh (`TextRun.tsx`): a standard
 * median-of-3 signed-distance decode against the vendored atlas
 * (`openSansAtlas.ts`), screen-space antialiased via `fwidth`, plus a
 * `distanceBias` uniform a synthesized-bold pass can push positive to
 * embolden strokes (widening the shape by shifting the zero-crossing before
 * thresholding) without re-baking the atlas.
 *
 * This is msdfgen's own standard shading technique (Chlumsky, "Shape
 * Decomposition for Multi-Channel Distance Fields"), not a Godot port — the
 * engine's own TextServer rasterizes through FreeType bitmaps, not MSDF, so
 * there is no Godot GLSL source for this stage to match.
 *
 * `clippingPlanes` is spread onto the material rather than shared by
 * reference: three.js clip planes are per-material state, and a later
 * mutation of the caller's array (say, a ScrollContainer resizing) must not
 * reach back into a material already built from an earlier snapshot of it.
 */
import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDistanceBias;
uniform float uPxRange;
varying vec2 vUv;

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
  float sigDist = median(msd.r, msd.g, msd.b) - 0.5 + uDistanceBias;
  float screenPxDistance = screenPxRange() * sigDist;
  float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(uColor, uOpacity * alpha);
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
}

export function createMsdfMaterial(options: MsdfMaterialOptions): THREE.ShaderMaterial {
  const { map, color, opacity, pxRange, distanceBias = 0, clippingPlanes = [] } = options;
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uMap: { value: map },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      uOpacity: { value: opacity },
      uDistanceBias: { value: distanceBias },
      uPxRange: { value: pxRange },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    clippingPlanes: [...clippingPlanes],
  });
}
