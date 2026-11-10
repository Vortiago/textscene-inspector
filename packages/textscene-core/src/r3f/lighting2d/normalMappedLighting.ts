/**
 * How a normal-mapped canvas item takes the light, per `canvas.glsl:652-760`. Each light reaches the
 * item at an angle, so it shades each light kept apart (`lightPassContext.ts`) by its own normal
 * term before it blends, in Godot's order. The arithmetic is Godot's, in sRGB space with its [0, 1]
 * clamp, as `canvasItemLighting.ts` does for an item with no normal map.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math.js';
import { editedProgram } from '../shaderPatch/chunkPatch.js';
import {
  ITEM_ALBEDO_GLSL,
  ITEM_LIGHTING_GLSL,
  LIGHT_MODE_GLSL,
  type CanvasItemLightingProps,
  type CanvasItemLightingUniforms,
} from './canvasItemLighting.js';

/** What a CanvasTexture adds to an item's diffuse texture, sampled where the diffuse is. */
export interface CanvasItemSurface {
  /** Raw, without the sRGB decode (`texture_storage.cpp:766`). */
  readonly normalMap: THREE.Texture;
  /** Raw, or null for Godot's white default (`texture_storage.cpp:773-776`). */
  readonly specularMap: THREE.Texture | null;
  /** `canvasTextureSpecular`: null while the shininess leaves specular off. */
  readonly specular: Rgba | null;
}

/**
 * The uniform objects a normal-mapped item binds once and mutates, for the reason
 * `CanvasItemLightingUniforms` gives. The resolution, the canvas modulate and the light mode are the
 * item's own, shared with its plain program.
 */
export interface NormalMappedLightingUniforms extends Pick<
  CanvasItemLightingUniforms,
  'resolution' | 'canvasModulate' | 'lightMode'
> {
  /** `ApartLightBuffers.buffer`. */
  readonly lightLayers: THREE.IUniform;
  /** `ApartLightBuffers.shadowTintBuffer`, or a black layer while no light tints. */
  readonly shadowTintLayers: THREE.IUniform;
  /** `ApartLightBuffers.places`. */
  readonly places: THREE.IUniform;
  /** `ApartLightBuffers.modes`. */
  readonly modes: THREE.IUniform;
  /** The normal map, raw, sampled where the diffuse is. */
  readonly normalMap: THREE.IUniform;
  /** The specular map, raw, or white while the CanvasTexture names none. */
  readonly specularMap: THREE.IUniform;
  /** `canvasTextureSpecular` as a Vector4. */
  readonly specular: THREE.IUniform;
  /** 1 while specular is in use, else 0. */
  readonly usesSpecular: THREE.IUniform;
}

const VERTEX_PREAMBLE = `varying vec2 vCanvasPosition;
varying vec4 vItemAxes;
void main() {`;

// The canvas's world frame: Godot's canvas flipped to y up, with the same light vectors and normals
// flipped alike, so every dot product is Godot's. `canvas.glsl:708` normalises the item's axes.
const VERTEX_INJECTION = `#include <project_vertex>
vCanvasPosition = (modelMatrix * vec4(transformed, 1.0)).xy;
vItemAxes = vec4(normalize(modelMatrix[0].xy), normalize(modelMatrix[1].xy));`;

const FRAGMENT_PREAMBLE = `uniform highp sampler2DArray uLightLayers;
uniform highp sampler2DArray uShadowTintLayers;
uniform vec3 uLightPlaces[APART_LIGHT_COUNT];
uniform vec3 uLightModes[APART_LIGHT_COUNT];
uniform sampler2D uNormalMap;
uniform sampler2D uSpecularMap;
uniform vec4 uSpecular;
uniform float uUsesSpecular;
${ITEM_LIGHTING_GLSL}
varying vec2 vCanvasPosition;
varying vec4 vItemAxes;

// Where a tile samples its maps: the diffuse's uv, held inside the tile where the diffuse is
// (tile_set.cpp:5622-5671, which pads every map of a CanvasTexture alike).
vec2 surfaceUv() {
#ifdef TILE_UV_BOUNDS
  return clamp(vMapUv, vTileUvBounds.xy, vTileUvBounds.zw);
#else
  return vMapUv;
#endif
}

// canvas.glsl:652-665 and :706-712. Godot's decode, vec2(2, -2) - vec2(1, -1), flips y into its
// y-down canvas. The world frame is y up, so the flip drops out, and Godot's transpose, which swaps
// the y-down components, negates both here. A tile's flips then negate their own component.
vec3 itemNormal() {
  vec3 normal;
  normal.xy = texture2D(uNormalMap, surfaceUv()).xy * 2.0 - 1.0;
#ifdef TILE_NORMAL_ORIENTATION
  if (vTileNormalOrientation.z > 0.5) normal.xy = -normal.yx;
  normal.xy *= vTileNormalOrientation.xy;
#endif
  normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy)));
  normal.xy = mat2(vItemAxes.xy, vItemAxes.zw) * normal.xy;
  return normalize(normal);
}

// canvas.glsl:739 for a directional light, :797-799 for a positional one.
vec3 lightVector(vec3 place, bool directional) {
  if (directional) return normalize(mix(vec3(place.xy, 0.0), vec3(0.0, 0.0, 1.0), place.z));
  return normalize(place - vec3(vCanvasPosition, 0.0));
}

// canvas.glsl:474-494.
vec3 lightNormalCompute(vec3 light_vec, vec3 normal, vec3 base_color, vec3 light_color, vec4 specular, bool specular_used) {
  float cNdotL = max(0.0, dot(normal, light_vec));
  if (!specular_used) return light_color * base_color * cNdotL;
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 half_vec = normalize(view + light_vec);
  float cNdotV = max(dot(normal, view), 0.0);
  float cNdotH = max(dot(normal, half_vec), 0.0);
  float shininess = exp2(15.0 * specular.a + 1.0) * 0.25;
  float blinn = pow(cNdotH, shininess);
  blinn *= (shininess + 8.0) * (1.0 / (8.0 * PI));
  float s = blinn / max(4.0 * cNdotV * cNdotL, 0.75);
  return specular.rgb * light_color * s + light_color * base_color * cNdotL;
}

void main() {`;

// A layer holds a light's term premultiplied by its alpha `A`: `light_color.rgb * A`, with the
// shadow applied, and its `shadow_color` term likewise, both negated by a SUB light. The normal term
// is linear in the light colour, so shading the layer is shading the light, and each blend of
// `light_blend_compute` (canvas.glsl:549-563) is `color * (1 - A·mix) + term`.
const FRAGMENT_INJECTION = `${LIGHT_MODE_GLSL}
if (!unshaded) {
  ${ITEM_ALBEDO_GLSL}
  vec3 normal = itemNormal();
  bool usesSpecular = uUsesSpecular > 0.5;
  vec4 specular = usesSpecular ? texture2D(uSpecularMap, surfaceUv()) * uSpecular : vec4(1.0);
  vec3 color = albedo * lightSeed;
  float lightOnlyAlpha = 0.0;
  for (int i = 0; i < APART_LIGHT_COUNT; i++) {
    vec4 lit = texture(uLightLayers, vec3(lightUv, float(i)));
    float tintLayer = uLightModes[i].z;
    vec3 tint = tintLayer < 0.0 ? vec3(0.0) : texture(uShadowTintLayers, vec3(lightUv, tintLayer)).rgb;
    vec3 lightVec = lightVector(uLightPlaces[i], uLightModes[i].x > 0.5);
    vec3 term = lightNormalCompute(lightVec, normal, albedo, lit.rgb, specular, usesSpecular) + tint;
    color = color * (1.0 - uLightModes[i].y * lit.a) + term;
    lightOnlyAlpha += lit.a;
  }
  if (lightOnly) gl_FragColor.a = clamp(gl_FragColor.a * lightOnlyAlpha, 0.0, 1.0);
  gl_FragColor.rgb = godotToLinear(clamp(color, 0.0, 1.0));
}
#include <colorspace_fragment>`;

/**
 * Props that make a `meshBasicMaterial` shade `lightCount` lights kept apart by the item's normal
 * map, as a merge part for `materialProgramInputs()`. The count sizes the program, so a list that
 * gains a light remounts the material through its key.
 */
export function normalMappedLightingProps(
  uniforms: NormalMappedLightingUniforms,
  lightCount: number
): CanvasItemLightingProps {
  return {
    transparent: true,
    injection: {
      cacheKey: `godot-canvas-normal-light-${lightCount}`,
      onBeforeCompile: (shader) => {
        shader.uniforms.uLightLayers = uniforms.lightLayers;
        shader.uniforms.uShadowTintLayers = uniforms.shadowTintLayers;
        shader.uniforms.uLightPlaces = uniforms.places;
        shader.uniforms.uLightModes = uniforms.modes;
        shader.uniforms.uNormalMap = uniforms.normalMap;
        shader.uniforms.uSpecularMap = uniforms.specularMap;
        shader.uniforms.uSpecular = uniforms.specular;
        shader.uniforms.uUsesSpecular = uniforms.usesSpecular;
        shader.uniforms.uLightResolution = uniforms.resolution;
        shader.uniforms.uCanvasModulate = uniforms.canvasModulate;
        shader.uniforms.uLightMode = uniforms.lightMode;

        editedProgram(
          shader,
          {
            vertex: [
              { three: 'void main() {', godot: VERTEX_PREAMBLE },
              { three: '#include <project_vertex>', godot: VERTEX_INJECTION },
            ],
            fragment: [
              {
                three: 'void main() {',
                godot: `#define APART_LIGHT_COUNT ${lightCount}\n${FRAGMENT_PREAMBLE}`,
              },
              { three: '#include <colorspace_fragment>', godot: FRAGMENT_INJECTION },
            ],
          },
          'normal-mapped canvas item lighting'
        );
      },
    },
  };
}
