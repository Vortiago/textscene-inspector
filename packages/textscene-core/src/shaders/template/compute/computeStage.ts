import { templateVariant } from '../link.js';
import { parseTemplateStage } from '../parseTemplate.js';
import { preprocess } from '../preprocess.js';
import type { TemplateStageNode } from '../templateTree.js';

/** A template's own stages hold no material, so no slot takes code. */
const NO_MATERIAL = { custom: [], hasUniforms: false, code: new Map() };

/** The compute stage of `file` under the variant `defines`, as Godot's `ShaderRD` builds it. */
export function computeStage(file: string, defines: string): TemplateStageNode {
  return parseTemplateStage('compute', preprocess(templateVariant(file, 'compute', defines, NO_MATERIAL)));
}
