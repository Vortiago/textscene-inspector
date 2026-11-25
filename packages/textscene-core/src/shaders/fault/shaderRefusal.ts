/** Godot's refusal of a text, or the transpiler's for a construct it does not port yet, with its owner. */
export interface ShaderRefusal {
  readonly message: string;
  readonly owner?: string;
}

/** Why a shader draws Godot's default instead: a refusal of its text, or a defect, which is no refusal. */
export type ShaderUnDrawn = { readonly refusal: ShaderRefusal } | { readonly failure: unknown };

/** The message for the shader Godot generates for a `materialClass`, which draws the classic material. */
export function generatedUnDrawnMessage(compile: ShaderUnDrawn, materialClass: string): string {
  const shader = `the shader Godot generates for this ${materialClass}`;
  if ('failure' in compile)
    return `The previewer failed to translate ${shader}, and draws the classic material: ${String(compile.failure)}`;
  const { refusal } = compile;
  // Godot compiles every text it generates, so a refusal with no owner is the previewer's fault.
  if (refusal.owner === undefined)
    return `The previewer wrote ${shader} wrongly, and draws the classic material: ${refusal.message}`;
  return `The previewer does not translate ${shader} yet (${refusal.owner}), and draws the classic material: ${refusal.message}`;
}

/** The message for a `kind` shader the previewer does not draw, which draws Godot's default `fallback`. */
export function unDrawnMessage(compile: ShaderUnDrawn, kind: string, fallback: string): string {
  if ('failure' in compile)
    return `The previewer failed to translate this ${kind} shader, and draws Godot's default ${fallback}: ${String(compile.failure)}`;
  const { refusal } = compile;
  if (refusal.owner === undefined)
    return `Godot does not compile the ${kind} shader, and draws its default ${fallback}: ${refusal.message}`;
  return `The previewer does not translate this ${kind} shader yet (${refusal.owner}), and draws Godot's default ${fallback}: ${refusal.message}`;
}
