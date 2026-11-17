import { glslBlock } from '../language/godotText.js';
import { INSTRUCTION_TABLE } from '../language/instructionTable.generated.js';
import type { BlockNode, FunctionNode, ShaderNode, StructNode, VaryingNode } from '../language/shaderTree.js';
import { shapeOf } from '../language/types.js';
import { everyExpressionIn, withConstantsFirst } from '../language/treeWalk.js';
import { GENERAL_DEFINES } from './generalDefines.js';
import { godotId, GodotIds } from './godotIds.js';
import type { ModeTable } from './modeTable.js';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import { splitStages, type StageName } from './stages.js';
import { TEMPLATE_FILES } from './templateFiles.generated.js';
import type { GlobalNode, TemplateStageNode } from './templateTree.js';
import { variantLines } from './variant.js';

/** What a material gives each variant of a template: Godot's `GeneratedCode` and its defines. */
export interface CompiledMaterial {
  /** The body of each stage function, by its code section, `SKY`, with Godot's ids. */
  readonly code: ReadonlyMap<string, BlockNode>;
  /** The structs and the other functions, which the `#GLOBALS` slot takes. */
  readonly globals: readonly (StructNode | FunctionNode)[];
  /** The varyings each stage's `#GLOBALS` slot declares first (`shader_compiler.cpp:688-737`). */
  readonly varyings: Readonly<Record<'vertex' | 'fragment', readonly GlobalNode[]>>;
  /** The defines of the material's render modes, then of the built-ins it reads: `custom_defines`. */
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
  for (const parsed of shader.functions) {
    // GLSL reads the material as the text Godot writes for it, so its tree is the one GLSL reads.
    const definition = { ...parsed, body: glslBlock(withConstantsFirst(shader, parsed)) };
    if (stages.has(definition.rname)) code.set(definition.rname.toUpperCase(), ids.block(definition.body));
    else functions.push(ids.function(definition));
  }
  return {
    code,
    globals: [...shader.structs.map((struct) => ids.struct(struct)), ...functions],
    varyings: varyingGlobals(shader.varyings),
    custom: [...renderModeDefines(shader, table), ...usageDefines(shader, table)],
    renames: table.renames,
  };
}

/** Each varying as an `out` and an `in`, or a fragment global when `fragment()` writes it. */
function varyingGlobals(varyings: readonly VaryingNode[]): CompiledMaterial['varyings'] {
  const vertex: GlobalNode[] = [];
  const fragment: GlobalNode[] = [];
  for (const varying of varyings) {
    const declared = (words: string[]): GlobalNode => ({
      kind: 'global',
      qualifiers: { layout: [], words },
      type: varying.type,
      declarators: [
        {
          name: godotId(varying.name),
          ...(varying.arraySize ? { arraySize: varying.arraySize } : {}),
          position: varying.position,
        },
      ],
      position: varying.position,
    });
    if (varying.stage === 'fragment') {
      fragment.push(declared([]));
      continue;
    }
    // A boolean varying never assigned has no GLSL declaration (`shader_compiler.cpp:697`).
    if (shapeOf(varying.type)?.scalar === 'bool') continue;
    const interpolation = varying.interpolation === 'flat' ? ['flat'] : [];
    vertex.push(declared([...interpolation, 'out']));
    fragment.push(declared([...interpolation, 'in']));
  }
  return { vertex, fragment };
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

/** The define of each render mode, once per mode, in the text's order (`shader_compiler.cpp:457-461`). */
function renderModeDefines(shader: ShaderNode, table: ModeTable): string[] {
  const modes = new Set(shader.renderModes.map((mode) => mode.name));
  return [...modes].flatMap((mode) => table.render_mode_defines[mode] ?? []);
}

/** Each usage define of the built-ins `shader` reads, once, in the order of the text. */
function usageDefines(shader: ShaderNode, table: ModeTable): string[] {
  const defines = new Set<string>();
  for (const definition of shader.functions)
    for (const expression of everyExpressionIn(definition.body)) {
      if (expression.kind !== 'variable' || !expression.builtIn) continue;
      const define = table.usage_defines[expression.name];
      // `@NAME` reads the define of NAME (`shader_compiler.cpp:908-910`).
      const resolved = define?.startsWith('@') ? table.usage_defines[define.slice(1)] : define;
      if (resolved) defines.add(resolved);
    }
  return [...defines];
}
