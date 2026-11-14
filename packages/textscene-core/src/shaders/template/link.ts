/**
 * The link step: a port of `ShaderCompiler::compile` (`servers/rendering/shader_compiler.cpp:1509`)
 * and of `ShaderRD`'s variant build. A material's tree fills the slots of a template stage, its
 * built-ins read as the GLSL text of the shader type's mode table, and its nodes keep the user's
 * positions, so an error names the user's line.
 */

import { INSTRUCTION_TABLE } from '../language/instructionTable.generated.js';
import type { BlockNode, FunctionNode, ShaderNode, StructNode } from '../language/shaderTree.js';
import { everyExpressionIn } from '../language/treeWalk.js';
import { GENERAL_DEFINES } from './generalDefines.js';
import { GodotIds } from './godotIds.js';
import type { ModeTable } from './modeTable.js';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import { splitStages, type StageName } from './stages.js';
import { TEMPLATE_FILES } from './templateFiles.generated.js';
import type { TemplateStageNode } from './templateTree.js';
import { variantLines } from './variant.js';

/** What a material gives each variant of a template: Godot's `GeneratedCode` and its defines. */
export interface CompiledMaterial {
  /** The body of each stage function, by its code section, `SKY`, with Godot's ids. */
  readonly code: ReadonlyMap<string, BlockNode>;
  /** The structs and the other functions, which the `#GLOBALS` slot takes. */
  readonly globals: readonly (StructNode | FunctionNode)[];
  /** The usage defines of the built-ins the material reads, `custom_defines`. */
  readonly custom: readonly string[];
  /** The GLSL text of each built-in. */
  readonly renames: Readonly<Record<string, string>>;
}

/** The material's tree as Godot's compiler hands it to `ShaderRD`. */
export function compileMaterial(shader: ShaderNode, table: ModeTable): CompiledMaterial {
  const ids = new GodotIds(shader.structs);
  const stages = stageFunctionsOf(shader.shaderType ?? '');
  const code = new Map<string, BlockNode>();
  const functions: FunctionNode[] = [];
  for (const definition of shader.functions) {
    if (stages.has(definition.rname)) code.set(definition.rname.toUpperCase(), ids.block(definition.body));
    else functions.push(ids.function(definition));
  }
  return {
    code,
    globals: [...shader.structs.map((struct) => ids.struct(struct)), ...functions],
    custom: usageDefines(shader, table),
    renames: table.renames,
  };
}

/** One stage of a template variant, with `material` in its slots. */
export function linkTemplateStage(
  file: string,
  stage: StageName,
  variant: string,
  material: CompiledMaterial
): TemplateStageNode {
  const lines = splitStages(file, (path) => TEMPLATE_FILES[path])[stage];
  if (!lines) throw new Error(`expected a ${stage} stage in ${file}, found none`);
  const defines = {
    general: GENERAL_DEFINES[file] ?? '',
    variant,
    custom: material.custom,
    hasUniforms: false,
    codeSections: [...material.code.keys()],
  };
  return parseTemplateStage(stage, preprocess(variantLines(lines, defines)), material);
}

/** The stage functions of a shader type, `sky`: each scope of its built-ins but the shared ones. */
function stageFunctionsOf(shaderType: string): ReadonlySet<string> {
  const scopes = INSTRUCTION_TABLE.filter((row) => row.id.startsWith(`${shaderType}.`)).map(
    (row) => row.id.split('.')[1]!
  );
  return new Set(scopes.filter((scope) => scope !== 'global' && scope !== 'constants'));
}

/** Each usage define of the built-ins `shader` reads, once, in the order of the text. */
function usageDefines(shader: ShaderNode, table: ModeTable): string[] {
  const defines = new Set<string>();
  for (const definition of shader.functions)
    for (const expression of everyExpressionIn(definition.body)) {
      if (expression.kind !== 'variable' || !expression.builtIn) continue;
      const define = table.usage_defines[expression.name];
      if (define) defines.add(define);
    }
  return [...defines];
}
