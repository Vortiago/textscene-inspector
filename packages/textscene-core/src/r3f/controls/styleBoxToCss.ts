/**
 * Control-side adapter over the StyleBox resource slice (ADR-0003, ADR-0031):
 * a raw theme-resource property bag → the CSS a Control's `<div>` wears. The
 * decode and the CSS mapping live in `resources/styles/stylebox/`; this file is
 * what the overlay components import, plus the two colour helpers they share.
 *
 * A box type the slice does not decode (`StyleBoxTexture`, or a reference that
 * resolved to a non-StyleBox) maps to `{}` rather than throwing.
 *
 * `styleBoxToCss` is the type-plus-property-bag entry — the shape the
 * value-grammar contract pins (`valueDecoderGrammar.contract.test.ts`), which is
 * why it stays even though Controls reach a box by reference through
 * `resolveStyleBox` instead.
 */

import type { CSSProperties } from 'react';
import { parseColor } from '../../utils/colorParser';
import { buildStyleBoxCss, controlColorToCss } from '../../resources/styles/stylebox/build';
import { decodeStyleBox } from '../../resources/styles/stylebox/decode';
import { compositeCallPrefix } from '../../godot/index.js';

const COLOR_CALL = compositeCallPrefix('Color');

export { controlColorToCss };

export function colorToCss(value: string): string | undefined {
  // parseColor() falls back to white on bad input rather than throwing, so we
  // gate on the Color(...) form here to avoid silently emitting white.
  if (!COLOR_CALL.test(value.trim())) return undefined;
  return controlColorToCss(parseColor(value));
}

export function styleBoxToCss(type: string, data: Record<string, string>): CSSProperties {
  const decoded = decodeStyleBox(type, data);
  return decoded ? buildStyleBoxCss(decoded) : {};
}
