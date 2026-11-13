/**
 * The light node of every directional light: Godot's directional light, from the pooled rows of the
 * lit pipeline its material draws with, its shadow from Godot's directional atlas. For a material of
 * three's own it is three's directional light node.
 */

import { float } from 'three/tsl';
import { DirectionalLightNode, type LightsNode, type NodeBuilder } from 'three/webgpu';
import { litPipelineOf, type LitPipeline } from './litPipeline.js';
import type { FloatNode, GodotDirectLightData } from './nodeTypes.js';
import { isSplitShadow, SUN_ROW, SUN_ROWS, writeSunRows } from './sunRows.js';

/** The members of a builder that three's types leave out. */
interface LightBuilder {
  lightsNode: LightsNode;
}

export class GodotSunLightNode extends DirectionalLightNode {
  static get type(): string {
    return 'GodotSunLightNode';
  }

  override setup(builder: NodeBuilder): undefined {
    const pipeline = litPipelineOf(builder.material);
    if (!pipeline) {
      super.setup(builder);
      return undefined;
    }
    const light = this.light!;
    const slot = pipeline.sunRows.slotFor(light, (write, frame) =>
      writeSunRows(write, light, frame.camera ?? null, pipeline.inputs.directionalSoftShadows ?? false)
    );
    // Every slot holds a light still in a scene, so this one draws nothing, as Godot past its limit.
    if (slot === null) return undefined;
    const direction = pipeline.sunRows.row(slot, SUN_ROW.direction);
    const colour = pipeline.sunRows.row(slot, SUN_ROW.colour);
    const data: GodotDirectLightData = {
      lightDirection: direction.xyz,
      lightColor: colour.xyz,
      attenuation: this.shadowOf(builder, pipeline, slot),
      A: direction.w,
      specularAmount: colour.w,
    };
    (builder as unknown as LightBuilder).lightsNode.setupDirectLight(builder, this, data);
    return undefined;
  }

  /** The shadow at the fragment, or 1 for a light, a surface or a renderer that draws none. */
  private shadowOf(builder: NodeBuilder, pipeline: LitPipeline, slot: number): FloatNode {
    const lookup = pipeline.sunShadow(builder);
    const light = this.light!;
    const draws =
      lookup !== null &&
      light.castShadow &&
      isSplitShadow(light.shadow) &&
      builder.object.receiveShadow &&
      builder.renderer.shadowMap.enabled;
    return draws ? lookup.shadow(slot * SUN_ROWS) : float(1);
  }
}
