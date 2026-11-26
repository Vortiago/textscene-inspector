/** Godot's refusal of a text, or the transpiler's for a construct it does not port yet, with its owner. */
export interface ShaderRefusal {
  readonly message: string;
  readonly owner?: string;
}

/** Why a shader draws Godot's default instead: a refusal of its text, or a defect, which is no refusal. */
export type ShaderUnDrawn = { readonly refusal: ShaderRefusal } | { readonly failure: unknown };

/** Whether the classic path draws a `materialClass`: it declines an ORMMaterial3D. */
export const hasClassicMaterial = (materialClass: string): boolean => materialClass !== 'ORMMaterial3D';

/** What a `materialClass` draws without its generated shader. */
export const generatedFallbackOf = (materialClass: string): string =>
  hasClassicMaterial(materialClass) ? 'the classic material' : "Godot's default 3D surface";

/** The message for the shader Godot generates for a `materialClass`, which draws its fallback. */
export function generatedUnDrawnMessage(compile: ShaderUnDrawn, materialClass: string): string {
  const shader = `the shader Godot generates for this ${materialClass}`;
  const fallback = generatedFallbackOf(materialClass);
  if ('failure' in compile)
    return `The previewer failed to translate ${shader}, and draws ${fallback}: ${String(compile.failure)}`;
  const { refusal } = compile;
  // Godot compiles every text it generates, so a refusal with no owner is the previewer's fault.
  if (refusal.owner === undefined)
    return `The previewer wrote ${shader} wrongly, and draws ${fallback}: ${refusal.message}`;
  return `The previewer does not translate ${shader} yet (${refusal.owner}), and draws ${fallback}: ${refusal.message}`;
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
