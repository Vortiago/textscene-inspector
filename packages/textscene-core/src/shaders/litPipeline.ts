/**
 * The lit pipeline of one renderer: its pipeline inputs, the pooled rows of each light kind, and the
 * lookups built on them. Each Godot lit material of the renderer holds it, and a light node reads it
 * from the material it builds for, because three keeps one light node per light for the whole page.
 */

import { uniform } from 'three/tsl';
import { LightRows } from './lightRows.js';
import { GodotSkyLightingNode } from './skyLightingNode.js';
import type { PipelineInputs } from './pipelineInputs.js';
import { SunShadow } from './sunShadowNode.js';
import { MAX_SUNS, SUN_ROWS } from './sunRows.js';

export class LitPipeline {
  readonly sunRows = new LightRows(SUN_ROWS, MAX_SUNS);
  /** `emissive_exposure_normalization` for the render that draws, 1 while the inputs hold none. */
  readonly emissionExposure = uniform(1).onFrameUpdate(() => this.inputs.emissionExposure?.[0] ?? 1);

  /** The caller writes `inputs` before a material first draws, as `pipelineInputs.ts` says. */
  constructor(readonly inputs: PipelineInputs) {}
  /** Undefined until the first ask, then the lookup of the atlas the inputs held then, or null. */
  private sunShadowLookup: SunShadow | null | undefined;
  /** Null until the first ask, then the node of the sky the inputs held then. */
  private skyNode: GodotSkyLightingNode | null = null;

  /** The directional shadow lookup, or null while the inputs hold no atlas. */
  sunShadow(): SunShadow | null {
    if (this.sunShadowLookup === undefined) {
      const atlas = this.inputs.sunShadow;
      this.sunShadowLookup = atlas ? new SunShadow(this.sunRows, atlas) : null;
    }
    return this.sunShadowLookup;
  }

  /** The sky's lighting node, which every lit material of the renderer shares. */
  skyLighting(): GodotSkyLightingNode {
    this.skyNode ??= new GodotSkyLightingNode(this.inputs.sky ?? null);
    return this.skyNode;
  }
}

/** A material that draws with a lit pipeline. */
interface PipelineMaterial {
  readonly litPipeline: LitPipeline;
}

/** The pipeline `material` draws with, or null for a material of three's own. */
export function litPipelineOf(material: unknown): LitPipeline | null {
  const candidate = material as Partial<PipelineMaterial> | null;
  return candidate?.litPipeline instanceof LitPipeline ? candidate.litPipeline : null;
}
