import type { StageLine } from './stages.js';

/** Where Godot puts a material's compiled code: its globals, its uniforms or one stage function. */
export type SlotKind = 'GLOBALS' | 'MATERIAL_UNIFORMS' | 'CODE';

export interface Slot {
  readonly kind: SlotKind;
  /** The stage function a `CODE` slot takes, upper case, `SKY`. Empty for the others. */
  readonly name: string;
}

/** A line of a variant: text where Godot's files or the defines put it, or a slot. */
export type VariantLine =
  | (StageLine & { readonly slot?: undefined })
  | { readonly slot: Slot; readonly file: string; readonly line: number };

/** The file name a line of the defines carries, which no template file has. */
const DEFINES_FILE = '<defines>';

/** `ShaderRD::Version`: each define string is Godot's `#define` lines with their line breaks. */
export interface VariantDefines {
  /** The defines of the shader class, `initialize`'s `p_general_defines`. */
  readonly general: string;
  /** The defines of the variant, `variant_defines[p_variant].text`. */
  readonly variant: string;
  /** The material's usage and render mode defines, `custom_defines`. */
  readonly custom: readonly string[];
  /** Whether the material declares uniforms: Godot then defines `MATERIAL_UNIFORMS_USED`. */
  readonly hasUniforms: boolean;
  /** The code sections the material fills, `SKY`: Godot defines `SKY_CODE_USED` for each. */
  readonly codeSections: readonly string[];
}

/** The lines of one variant of a stage, in Godot's order. */
export function variantLines(lines: readonly StageLine[], defines: VariantDefines): VariantLine[] {
  const out: VariantLine[] = [];
  // `_add_stage` reads the text after `"\n".join(lines) + "\n"`, so its last line is empty.
  const stageLines = [
    ...lines,
    { text: '', file: lines.at(-1)?.file ?? '', line: (lines.at(-1)?.line ?? 0) + 1 },
  ];
  for (const line of stageLines) {
    const slot = slotOf(line.text);
    if (slot === 'VERSION_DEFINES') out.push(...definesLines(defines));
    else if (slot) out.push({ slot, file: line.file, line: line.line });
    else out.push(line);
  }
  return out;
}

/** The chunk a line starts, as `_add_stage` tells them apart with `begins_with`. */
function slotOf(text: string): Slot | 'VERSION_DEFINES' | undefined {
  if (text.startsWith('#VERSION_DEFINES')) return 'VERSION_DEFINES';
  if (text.startsWith('#GLOBALS')) return { kind: 'GLOBALS', name: '' };
  if (text.startsWith('#MATERIAL_UNIFORMS')) return { kind: 'MATERIAL_UNIFORMS', name: '' };
  if (!text.startsWith('#CODE')) return undefined;
  const name = text.replace('#CODE', '').replaceAll(':', '').trim().toUpperCase();
  return { kind: 'CODE', name };
}

/** The text `_build_variant_code` writes for `#VERSION_DEFINES` (`shader_rd.cpp:221-240`). */
function definesText(defines: VariantDefines): string {
  return [
    '\n',
    defines.general,
    defines.variant,
    ...defines.custom,
    '\n',
    defines.hasUniforms ? '#define MATERIAL_UNIFORMS_USED\n' : '',
    ...defines.codeSections.map((name) => `#define ${name}_CODE_USED\n`),
    // The previewer draws as Godot's Vulkan driver, whose GLSL the probes compare with.
    '#define RENDER_DRIVER_VULKAN\n',
    '#define samplerExternalOES sampler2D\n',
    '#define textureExternalOES texture2D\n',
  ].join('');
}

function definesLines(defines: VariantDefines): VariantLine[] {
  const text = definesText(defines);
  return text
    .slice(0, -1)
    .split('\n')
    .map((line, index) => ({ text: line, file: DEFINES_FILE, line: index + 1 }));
}
