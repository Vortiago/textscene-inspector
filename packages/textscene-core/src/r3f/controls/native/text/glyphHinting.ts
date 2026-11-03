/**
 * What the TrueType glyph loader (`sfntGlyf.ts`) asks of a hinter: FreeType's bytecode interpreter
 * (`truetype/`), which TextMesh loads on demand for a font that FreeType hints natively. A font
 * with neither a font program nor a control value program of more than 7 bytes goes to FreeType's
 * auto-hinter instead (`ftobjs.c`, `FT_Load_Glyph`).
 */

import type { GlyphZone } from './truetype/ttZone';
import type { SfntFile } from './sfntTables';

/** The hinter of one glyph load, `tt_loader_init`'s execution context. */
export interface GlyphLoadHinter {
  /**
   * Whether the v40 interpreter's backward compatibility is on, which keeps the side bearings and
   * a component's x offset unrounded. A glyph program may turn it off for the rest of the load.
   */
  readonly isBackwardCompatible: boolean;
  /**
   * `TT_Hint_Glyph`: rounds the phantom points and runs `instructions` on `zone` in place. A
   * composite's instructions see the hinted points of its components as their unscaled ones.
   * An instruction error keeps the points it has moved, as FreeType's non-pedantic mode does.
   */
  hint(zone: GlyphZone, instructions: Uint8Array, isComposite: boolean): void;
}

/** The glyph loads of one font, each at a ppem. */
export interface GlyphHinting {
  /**
   * The hinter of one load at `ppem`, whose 16.16 `scale` takes font units to 26.6 pixels. Null
   * when the control value program turns hinting off, so the glyph loads unhinted. `'failed'` when
   * the font program or the control value program failed at this size, so FreeType loads no glyph.
   */
  beginLoad(ppem: number, scale: number): GlyphLoadHinter | null | 'failed';
}

/** The size of a control value program that the auto-hinter still takes over from (`ftobjs.c`). */
const LARGEST_AUTOHINTED_CONTROL_VALUE_PROGRAM = 7;

/** Whether FreeType runs the font's own TrueType hints rather than its auto-hinter. */
export function isNativelyHinted({ tables }: SfntFile): boolean {
  const fontProgramLength = tables.get('fpgm')?.length ?? 0;
  const controlValueProgramLength = tables.get('prep')?.length ?? 0;
  return fontProgramLength > 0 || controlValueProgramLength > LARGEST_AUTOHINTED_CONTROL_VALUE_PROGRAM;
}
