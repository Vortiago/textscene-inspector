/**
 * The TSL light node of a split sun (`../directionalShadow/splitSun.ts`): its direction and colour,
 * its Godot specular amount, and its shadow from Godot's directional atlas. It ports the split
 * selection and PCF of `../directionalShadow/splitShadowChunk.ts` and
 * `../shadowFilter/softShadowFilter.ts` (`scene_forward_clustered.glsl:2403-2491`,
 * `scene_forward_lights_inc.glsl:283-308`). The blocker search of a sun with an angular distance is
 * not ported.
 */

import * as THREE from 'three';
import {
  cameraViewMatrix,
  Fn,
  float,
  If,
  int,
  mix,
  normalLocal,
  positionView,
  positionWorld,
  screenCoordinate,
  select,
  smoothstep,
  texture,
  transformNormalToView,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { AnalyticLightNode, type NodeFrame, type ShadowNode } from 'three/webgpu';
import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/rendering/lights/softShadowKernel.js';
import { NO_BLEND } from '../directionalShadow/fitDirectionalShadowSplits.js';
import { SPLIT_SLOTS } from '../directionalShadow/splitShadow.js';
import type { FloatNode, IntNode, Vec2Node, Vec3Node } from './nodeTypes.js';

/** The rows of one slot matrix the lookup reads: its fourth row is always (0, 0, 0, 1). */
const SLOT_MATRIX_ROWS = 3;

/** A slot blends while its blend start lies above this, as `splitShadowChunk.ts` reads it. */
const BLENDS_ABOVE = NO_BLEND / 2;

const PCF_KERNEL = vogelDisk(SOFT_LOW_SHADOW_SAMPLES);

/**
 * What the node reads of a sun's splits. `DirectionalSplitShadow` gives it on the classic pipeline,
 * whose fitter writes it before each render.
 */
export interface SplitShadow {
  /** One vec4 per slot, in the layout `fitDirectionalShadowSplits.ts` documents. */
  readonly _cascadeData: readonly THREE.Vector4[];
  /** World space to the slot's atlas position and depth. */
  getMatrix(slot: number): THREE.Matrix4;
  fade: { from: number; to: number };
  /** One split's rectangle in texels, and the atlas's size in those rectangles. */
  mapSize: THREE.Vector2;
  getFrameExtents(): THREE.Vector2;
  intensity: number;
  radius: number;
}

/** A light that shades as Godot's sun does, with its splits. */
export type SplitSun = THREE.Light & { readonly shadow: SplitShadow };

/** What the sun's shadow reads that the light does not hold. */
export interface SunShadowInputs {
  /** Godot's directional atlas, a depth texture with a compare function. */
  atlas: THREE.DepthTexture;
  /**
   * An atlas position as the texture node must receive it. three's GLSL builder turns the rows of
   * every depth texture over (r187 `TextureNode.js:412-432`), which suits a target its own WebGL 2
   * backend draws and not one `WebGLRenderer` draws.
   */
  atlasCoord: (uv: Vec2Node) => Vec2Node;
}

/** `quick_hash` (`scene_forward_lights_inc.glsl:278-281`). */
function quickHash(pixel: Vec2Node): FloatNode {
  return pixel.dot(vec2(0.06711056, 0.00583715)).fract().mul(52.9829189).fract();
}

export class GodotSunLightNode extends AnalyticLightNode<SplitSun> {
  static get type(): string {
    return 'GodotSunLightNode';
  }

  /** three's types leave out the colour `AnalyticLightNode` holds and its node (r187 `AnalyticLightNode.js:37-44`). */
  declare color: THREE.Color;
  declare colorNode: Vec3Node;

  /** The light's `A`: zero while Godot's directional soft shadows are off. */
  readonly sizeOffset = uniform(0);
  readonly specularAmount = uniform(1);

  private readonly direction = uniform(new THREE.Vector3());
  private readonly slotRows = Array.from(
    { length: SPLIT_SLOTS * SLOT_MATRIX_ROWS },
    () => new THREE.Vector4()
  );
  private readonly slotRowsNode = uniformArray<'vec4'>(this.slotRows, 'vec4');
  private readonly cascades = Array.from({ length: SPLIT_SLOTS }, () => new THREE.Vector4());
  private readonly cascadesNode = uniformArray<'vec4'>(this.cascades, 'vec4');
  private readonly fade = uniform(new THREE.Vector2());
  private readonly atlasSize = uniform(new THREE.Vector2(1, 1));
  private readonly shadowIntensity = uniform(1);
  private readonly shadowRadius = uniform(1);

  constructor(
    private readonly sun: SplitSun,
    private readonly shadowInputs: SunShadowInputs
  ) {
    super(sun);
    // Each render has its own camera and its own shadow pass.
    this.updateType = 'render';
  }

  override update(frame: NodeFrame): undefined {
    const light = this.sun;
    const { shadow } = light;
    this.color.copy(light.color).multiplyScalar(light.intensity);
    // three points a sun from the origin towards its world position (r187 `WebGLLights.js:566-571`).
    this.direction.value.setFromMatrixPosition(light.matrixWorld);
    if (frame.camera) this.direction.value.transformDirection(frame.camera.matrixWorldInverse);
    this.specularAmount.value = specularAmountOf(light);
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      this.cascades[slot]!.copy(shadow._cascadeData[slot]!);
      writeSlotRows(shadow.getMatrix(slot), this.slotRows, slot * SLOT_MATRIX_ROWS);
    }
    this.fade.value.set(shadow.fade.from, shadow.fade.to);
    this.atlasSize.value.copy(shadow.mapSize).multiply(shadow.getFrameExtents());
    this.shadowIntensity.value = shadow.intensity;
    this.shadowRadius.value = shadow.radius;
    return undefined;
  }

  override setupDirect(): { lightDirection: Vec3Node; lightColor: Vec3Node } {
    return { lightDirection: this.direction, lightColor: this.colorNode };
  }

  /** The shadow factor, which `AnalyticLightNode` multiplies the colour by. */
  override setupShadowNode(): ShadowNode {
    // A factor on the light's colour is all `AnalyticLightNode` reads of it (r187 `AnalyticLightNode.js:190`).
    return this.shadow() as unknown as ShadowNode;
  }

  private slotCoord(slot: IntNode, position: Vec3Node): Vec3Node {
    const row = slot.mul(SLOT_MATRIX_ROWS).toVar();
    const point = vec4(position, 1);
    const rows = this.slotRowsNode;
    return vec3(
      rows.element(row).dot(point),
      rows.element(row.add(1)).dot(point),
      rows.element(row.add(2)).dot(point)
    );
  }

  /** `sample_directional_pcf_shadow` (`scene_forward_lights_inc.glsl:283-308`) at Soft Low's four taps. */
  private pcf(pixelSize: Vec2Node, coord: Vec3Node): FloatNode {
    // `screenCoordinate` counts rows from the top on every backend, as Godot's `gl_FragCoord` does.
    const turn = quickHash(screenCoordinate)
      .mul(2 * Math.PI)
      .toVar();
    const sr = turn.sin().toVar();
    const cr = turn.cos().toVar();
    const shadow = float(0).toVar();
    for (const [x, y] of PCF_KERNEL) {
      const turned = vec2(cr.mul(x).add(sr.mul(y)), sr.negate().mul(x).add(cr.mul(y)));
      const tap = coord.xy.add(pixelSize.mul(turned));
      shadow.addAssign(texture(this.shadowInputs.atlas, this.shadowInputs.atlasCoord(tap)).compare(coord.z));
    }
    return shadow.mul(1 / PCF_KERNEL.length);
  }

  /** One split's shadow, lit outside the split's share of the atlas or past its far plane. */
  private readonly splitShadow = Fn(([slot, radiusScale]: [IntNode, FloatNode]) => {
    const split = this.cascadesNode.element(slot).toVar();
    const position = positionWorld.add(sunShadowWorldNormal.mul(split.z));
    const coord = this.slotCoord(slot, position).toVar();
    coord.z.addAssign(split.y);
    const isInside = coord.x
      .greaterThanEqual(0)
      .and(coord.x.lessThanEqual(1))
      .and(coord.y.greaterThanEqual(0))
      .and(coord.y.lessThanEqual(1))
      .and(coord.z.lessThanEqual(1));
    const result = float(1).toVar();
    If(isInside, () => {
      const pixelSize = vec2(1).div(this.atlasSize).mul(this.shadowRadius.mul(radiusScale));
      result.assign(mix(1, this.pcf(pixelSize, coord), this.shadowIntensity));
    });
    return result;
  });

  /** Godot's split by view depth, blended into the next over its last part, then faded out. */
  private readonly shadow = Fn(() => {
    const cascades = this.cascadesNode;
    const depth = positionView.z.negate().toVar();
    const fadeOut = select(
      this.fade.y.greaterThan(this.fade.x),
      smoothstep(this.fade.x, this.fade.y, depth),
      0
    ).toVar();
    const shadow = float(1).toVar();
    If(fadeOut.lessThan(1), () => {
      const split = int(3).toVar();
      If(depth.lessThan(cascades.element(0).x), () => {
        split.assign(0);
      })
        .ElseIf(depth.lessThan(cascades.element(1).x), () => {
          split.assign(1);
        })
        .ElseIf(depth.lessThan(cascades.element(2).x), () => {
          split.assign(2);
        });
      const selected = cascades.element(split).toVar();
      const blendsSplits = cascades.element(0).w.greaterThan(BLENDS_ABOVE);
      const radiusScale = select(blendsSplits, 1, cascades.element(0).x.div(selected.x));
      shadow.assign(this.splitShadow(split, radiusScale));
      If(
        split.lessThan(3).and(selected.w.greaterThan(BLENDS_ABOVE)).and(depth.greaterThan(selected.w)),
        () => {
          const next = this.splitShadow(split.add(1), float(1));
          shadow.assign(mix(shadow, next, smoothstep(selected.w, selected.x, depth)));
        }
      );
    });
    return mix(shadow, 1, fadeOut);
  });
}

/** The world normal the vertex stage hands the lookup's normal bias, as the patched chunk does. */
const sunShadowWorldNormal = varying(
  transformNormalToView(normalLocal).transformNormalByInverseViewMatrix(cameraViewMatrix),
  'vSunShadowWorldNormal'
);

/** `Matrix4.elements` is column-major, so row `r` is elements `r`, `r + 4`, `r + 8` and `r + 12`. */
function writeSlotRows(matrix: THREE.Matrix4, rows: THREE.Vector4[], offset: number): void {
  const e = matrix.elements;
  for (let row = 0; row < SLOT_MATRIX_ROWS; row++) {
    rows[offset + row]!.set(e[row]!, e[row + 4]!, e[row + 8]!, e[row + 12]!);
  }
}

/** The declared light's `light_specular`, or three's full specular for a light without one. */
function specularAmountOf(light: SplitSun): number {
  const declared = light.parent?.userData as { godotLightSpecular?: { amount?: number } } | undefined;
  return declared?.godotLightSpecular?.amount ?? 1;
}
