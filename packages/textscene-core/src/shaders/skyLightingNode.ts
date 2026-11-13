/**
 * How the shown sky lights a surface in Godot: its share of the ambient and its reflection, the
 * clearcoat's included, read from Godot's radiance layers at the mip the screen derivatives of the
 * direction pick (`scene_forward_clustered.glsl:1694-1797`, `oct_inc.glsl`). A scene without an
 * environment shows no sky, so the surface reads none, as the classic patch reads none without
 * three's `USE_ENVMAP`.
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
  vec3,
  vec4,
} from 'three/tsl';
import { LightingNode, type NodeBuilder } from 'three/webgpu';
import { MAX_ROUGHNESS_LOD } from '../godot/rendering/environment/skyReflection.js';
import type { GodotLightingModel } from './lightingModel.js';
import { lightingContextOf, type FloatNode, type Vec2Node, type Vec3Node } from './nodeTypes.js';
import type { SkyInputs } from './pipelineInputs.js';

/** `oct_wrap` and `vec3_to_oct_with_border` (`oct_inc.glsl`), as the classic `OCTMAP_GLSL` has them. */
function octWithBorder(direction: Vec3Node, borderSize: FloatNode): Vec2Node {
  const n = direction.div(direction.x.abs().add(direction.y.abs()).add(direction.z.abs())).toVar();
  const signs = vec2(select(n.x.greaterThanEqual(0), 1, -1), select(n.y.greaterThanEqual(0), 1, -1));
  const wrapped = n.yx.abs().oneMinus().mul(signs);
  const xy = select(n.z.greaterThanEqual(0), n.xy, wrapped);
  return xy.mul(0.5).add(0.5).mul(borderSize).add(borderSize.oneMinus().mul(0.5));
}

/** A reflection direction and how far below the surface's horizon it falls. */
interface Reflection {
  direction: Vec3Node;
  horizon: FloatNode;
}

export class GodotSkyLightingNode extends LightingNode {
  static get type(): string {
    return 'GodotSkyLightingNode';
  }

  /** The sky's share of the ambient, the layers' border size and the derivative scale. */
  private readonly layout = uniform(new THREE.Vector4());
  /** The energy, then 1 while a surface reflects the sky. */
  private readonly energy = uniform(new THREE.Vector4());
  private readonly toSky = uniform(new THREE.Matrix3());
  /** three hands a material without an `envMap` the scene's intensity (r187 `WebGLRenderer.js:2747-2751`). */
  private readonly intensity = uniform(1);
  /** 1 while the scene that renders has an environment. */
  private readonly shows = uniform(0);

  /**
   * Null `sky` reads no sky. The node still joins a material's lightings, so the lighting model runs
   * in a scene without lights, where Godot draws the ambient and the emission.
   */
  constructor(private readonly sky: SkyInputs | null) {
    super();
    if (!sky) return;
    this.layout.onRenderUpdate((_frame, self) => self.value.fromArray(sky.shown, 0));
    this.energy.onRenderUpdate((_frame, self) => self.value.fromArray(sky.shown, 4));
    this.toSky.onRenderUpdate((_frame, self) => self.value.fromArray(sky.rotation));
    this.intensity.onRenderUpdate(({ scene }) => scene?.environmentIntensity ?? 1);
    this.shows.onRenderUpdate(({ scene }) => (scene?.environment ? 1 : 0));
  }

  override setup(builder: NodeBuilder): undefined {
    if (!this.sky) return undefined;
    const context = lightingContextOf(builder);
    const model = context.lightingModel as GodotLightingModel;
    const isShown = this.shows.greaterThan(0);
    const { roughness, clearcoat } = model.terms;
    context.iblIrradiance.addAssign(select(isShown, this.irradiance(), vec3(0)));
    const reflection = this.reflectionAbout(normalView, roughness);
    context.radiance.addAssign(select(isShown, this.reflected(reflection, roughness.sqrt()), vec3(0)));
    if (clearcoat) {
      const coat = this.reflectionAbout(clearcoat.vertexNormal, clearcoat.roughness);
      const layer = mix(float(0.001), float(0.1), clearcoat.roughness.sqrt());
      model.coatSky = { isShown, radiance: this.reflected(coat, layer) };
    }
    return undefined;
  }

  /** `vec3_to_oct_lod` (`oct_inc.glsl:43-51`): the mip the direction's screen derivative picks. */
  private lod(direction: Vec3Node): FloatNode {
    const ddx = direction.dFdx();
    const ddy = direction.dFdy();
    const texelsSqr = ddx.dot(ddx).max(ddy.dot(ddy)).mul(this.layout.z);
    return texelsSqr.add(1e-6).log2().mul(0.25);
  }

  /** Radiance layer `layer` at the octmap texel `uv`, at mip `lod`. */
  private read(uv: Vec2Node, layer: FloatNode, lod: FloatNode): Vec3Node {
    return texture(this.sky!.layers, uv).depth(layer).level(lod).rgb;
  }

  /** A view-space direction in the sky's space, unnormalised, as Godot's is. */
  private inSkySpace(viewDirection: Vec3Node): Vec3Node {
    return this.toSky.mul(vec4(viewDirection, 0).mul(cameraViewMatrix).xyz);
  }

  /** The last radiance layer along the normal, at the sky's share of the ambient (`:1744-1756`). */
  private irradiance(): Vec3Node {
    const ambientDir = this.inSkySpace(normalView).toVar();
    const uv = octWithBorder(ambientDir, this.layout.y);
    return this.read(uv, float(MAX_ROUGHNESS_LOD), this.lod(ambientDir))
      .mul(Math.PI)
      .mul(this.intensity)
      .mul(this.layout.x);
  }

  /**
   * The view reflected about `normal`, bent towards it by `roughness` squared, with the horizon of the
   * surface's own normal (`:1704-1708`, `:1768-1774`).
   */
  private reflectionAbout(normal: Vec3Node, roughness: FloatNode): Reflection {
    const bent = mix(
      positionViewDirection.negate().reflect(normal),
      normal,
      roughness.mul(roughness)
    ).toVar();
    return { direction: this.inSkySpace(bent).toVar(), horizon: bent.dot(normalView).add(1).min(1).toVar() };
  }

  /** The two radiance layers around `layerFraction` of the last, blended, dimmed below the horizon. */
  private reflected({ direction, horizon }: Reflection, layerFraction: FloatNode): Vec3Node {
    const layerPosition = layerFraction.mul(MAX_ROUGHNESS_LOD).toVar();
    const layer = layerPosition.floor().toVar();
    const uv = octWithBorder(direction, this.layout.y).toVar();
    const lod = this.lod(direction).toVar();
    const blended = mix(this.read(uv, layer, lod), this.read(uv, layer.add(1), lod), layerPosition.fract());
    return blended.mul(this.intensity).mul(this.energy.y).mul(horizon).mul(horizon);
  }
}
