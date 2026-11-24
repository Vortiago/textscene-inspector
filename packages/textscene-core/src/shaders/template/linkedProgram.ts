import type { Value } from '../language/emitValue.js';
import { withGlslTypes } from '../language/glslTypes.js';
import { GODOT_VERSION } from '../language/instructionTable.generated.js';
import type { ParsedShader } from '../language/parseShader.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { checkTranspiled } from '../language/transpiledRows.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import { bindParameters, type TranspiledUniform } from '../uniforms/transpiledUniform.js';
import { programResources, type ProgramResources } from './emitTemplate.js';
import { godotId } from './godotIds.js';
import { compileMaterial, linkTemplateStage, type CompiledMaterial } from './link.js';
import { MODE_TABLES } from './modeTables.generated.js';
import type { StageName } from './stages.js';
import type { TemplateStageNode } from './templateTree.js';
import { TRANSPILER_VERSION, type TreeMemo } from './treeMemo.js';

/** The template variant a shader type draws with, and the memo that holds its linked stages. */
export interface ProgramTemplate {
  readonly shaderType: string;
  readonly template: string;
  readonly defines: string;
  readonly memo: TreeMemo;
}

/** A user's shader linked into its template, before either stage is emitted. */
export interface LinkedProgram {
  /** The template stage with the material's code linked in, under `defines` or the template's own. */
  readonly linked: (stage: StageName, defines?: string) => TemplateStageNode;
  /** The uniforms, textures, buffers and varyings that both stages share. */
  readonly resources: ProgramResources;
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
  /** The node of each material uniform, by the name it has in the linked stages. */
  readonly parameterValues: ReadonlyArray<readonly [string, Value]>;
}

/**
 * Links a parsed shader from `file` into `program`'s template.
 * @canonical link a user's shader into a Godot template
 */
export function linkedProgram(
  { code, tree }: ParsedShader,
  file: string,
  program: ProgramTemplate,
  sampling: ProjectSampling = GODOT_SAMPLING
): LinkedProgram {
  if (tree.shaderType !== program.shaderType)
    throw new ShadingLanguageError(
      `expected a shader of 'shader_type ${program.shaderType}', found ${tree.shaderType ?? 'none'}`,
      tree.headPosition ?? { file, line: 1, column: 1 }
    );
  checkTranspiled(tree);
  let material: CompiledMaterial | undefined;
  const linked = (stage: StageName, defines = program.defines): TemplateStageNode =>
    program.memo.tree(
      {
        source: code,
        file,
        shaderType: program.shaderType,
        template: program.template,
        stage,
        defines,
        godotVersion: GODOT_VERSION,
        transpilerVersion: TRANSPILER_VERSION,
      },
      () => {
        material ??= compileMaterial(withGlslTypes(tree), MODE_TABLES[program.shaderType]!);
        return linkTemplateStage(program.template, stage, defines, material);
      }
    );
  // A source colour is converted to linear: `sky.cpp:193`, `scene_shader_forward_clustered.cpp:595`.
  const parameters = bindParameters(tree, { useLinearColor: true, sampling });
  const parameterValues = [...parameters].map(([name, binding]) => [godotId(name), binding.value] as const);
  return { linked, resources: programResources(), parameters, parameterValues };
}
