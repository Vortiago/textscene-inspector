/**
 * How the sky lights a surface in Godot, as a TSL lighting node: its ambient light and its
 * reflection, read from Godot's radiance layers as `../godotSkyLighting.ts` reads them in GLSL
 * (`scene_forward_clustered.glsl:1704-1756`).
 */

import * as THREE from 'three';
import {
  cameraViewMatrix,
  float,
  mix,
  normalView,
  positionViewDirection,
  select,
  texture,
  uniform,
  vec2,
  vec4,
} from 'three/tsl';
import { LightingNode, type NodeBuilder } from 'three/webgpu';
import { MAX_ROUGHNESS_LOD } from '../../godot/rendering/environment/skyReflection.js';
import type { GodotLightingModel } from './godotLightingModel.js';
import { lightingContextOf, type FloatNode, type Vec2Node, type Vec3Node } from './nodeTypes.js';

/** The shown sky a surface reads. The classic pipeline bakes and shows it (`../sky/skyRadiance.ts`). */
export interface ShownSkyInputs {
  /** Godot's radiance layers, an octmap array. */
  layers: THREE.Texture;
  /** `godotShownSky`: the ambient share, the border size, the derivative scale, then energy and reflection. */
  shown: Float32Array;
  /** World to sky space, column-major. */
  rotation: Float32Array;
}

/** `oct_wrap` and `vec3_to_oct_with_border` (`oct_inc.glsl`). */
function vec3ToOctWithBorder(d: Vec3Node, borderSize: FloatNode): Vec2Node {
  const n = d.div(d.x.abs().add(d.y.abs()).add(d.z.abs())).toVar();
  const signs = vec2(select(n.x.greaterThanEqual(0), 1, -1), select(n.y.greaterThanEqual(0), 1, -1));
  const wrapped = n.yx.abs().oneMinus().mul(signs);
  const xy = select(n.z.greaterThanEqual(0), n.xy, wrapped);
  return xy.mul(0.5).add(0.5).mul(borderSize).add(borderSize.oneMinus().mul(0.5));
}

export class GodotSkyLightingNode extends LightingNode {
  static get type(): string {
    return 'GodotSkyLightingNode';
  }

  private readonly layers: THREE.Texture;
  private readonly shownLayout;
  private readonly shownEnergy;
  private readonly toSky;
  private readonly intensity;

  constructor(sky: ShownSkyInputs) {
    super();
    this.layers = sky.layers;
    this.shownLayout = uniform(new THREE.Vector4()).onRenderUpdate((_frame, self) => {
      self.value.fromArray(sky.shown, 0);
    });
    this.shownEnergy = uniform(new THREE.Vector4()).onRenderUpdate((_frame, self) => {
      self.value.fromArray(sky.shown, 4);
    });
    this.toSky = uniform(new THREE.Matrix3()).onRenderUpdate((_frame, self) => {
      self.value.fromArray(sky.rotation);
    });
    // three hands a material without an `envMap` the scene's intensity (r187 `WebGLRenderer.js:2747-2751`).
    this.intensity = uniform(1).onRenderUpdate(({ scene }) => scene?.environmentIntensity ?? 1);
  }

  /** `vec3_to_oct_lod` (`oct_inc.glsl:43-51`): the mip the direction's screen derivative picks. */
  private lod(direction: Vec3Node): FloatNode {
    const ddx = direction.dFdx();
    const ddy = direction.dFdy();
    const texelsSqr = ddx.dot(ddx).max(ddy.dot(ddy)).mul(this.shownLayout.z);
    return texelsSqr.add(1e-6).log2().mul(0.25);
  }

  private read(uv: Vec2Node, layer: FloatNode, lod: FloatNode): Vec3Node {
    return texture(this.layers, uv).depth(layer).level(lod).rgb;
  }

  /** A view-space direction in the sky's space, unnormalised, as Godot's is. */
  private inSkySpace(viewDirection: Vec3Node): Vec3Node {
    return this.toSky.mul(vec4(viewDirection, 0).mul(cameraViewMatrix).xyz);
  }

  /** The last radiance layer along the normal, at the sky's share of the ambient (`:1744-1756`). */
  private irradiance(): Vec3Node {
    const ambientDir = this.inSkySpace(normalView).toVar();
    const uv = vec3ToOctWithBorder(ambientDir, this.shownLayout.y);
    return this.read(uv, float(MAX_ROUGHNESS_LOD), this.lod(ambientDir))
      .mul(Math.PI)
      .mul(this.intensity)
      .mul(this.shownLayout.x);
  }

  /** The sky's reflection at Godot's roughness, dimmed below the horizon (`:1704-1721`). */
  private radiance(roughness: FloatNode): Vec3Node {
    const reflected = positionViewDirection.negate().reflect(normalView);
    const reflectVec = mix(reflected, normalView, roughness.mul(roughness)).toVar();
    const horizon = reflectVec.dot(normalView).add(1).min(1).toVar();
    const direction = this.inSkySpace(reflectVec).toVar();
    const layerPosition = roughness.sqrt().mul(MAX_ROUGHNESS_LOD).toVar();
    const layer = layerPosition.floor().toVar();
    const uv = vec3ToOctWithBorder(direction, this.shownLayout.y).toVar();
    const lod = this.lod(direction).toVar();
    const blended = mix(this.read(uv, layer, lod), this.read(uv, layer.add(1), lod), layerPosition.fract());
    return blended.mul(this.intensity).mul(this.shownEnergy.y).mul(horizon).mul(horizon);
  }

  override setup(builder: NodeBuilder): undefined {
    const context = lightingContextOf(builder);
    const model = context.lightingModel as GodotLightingModel;
    context.iblIrradiance.addAssign(this.irradiance());
    context.radiance.addAssign(this.radiance(model.surface.roughness));
    return undefined;
  }
}
