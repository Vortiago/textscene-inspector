/**
 * Tab-stop alignment — a port of `TextServer::shaped_text_tab_align`
 * (`modules/text_server_adv/text_server_adv.cpp:5688-5742`), LTR-only.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { isTabChar } from './textLayout';

/**
 * Recomputes every tab glyph's own advance so its pen lands on the next stop
 * in `tabStopsPx`, cycling back to the first stop once exhausted
 * (`:5722-5737`). Every OTHER glyph's advance is returned unchanged.
 *
 * Any non-positive stop makes the whole call a no-op (`:5700-5704`) — a
 * single 0 or negative entry disables tab alignment entirely, not just that
 * one stop.
 */
export function tabAlignAdvances(entries: ReadonlyArray<{ char: string; advance: number }>, tabStopsPx: readonly number[]): number[] {
  if (tabStopsPx.length === 0 || tabStopsPx.some((stop) => stop <= 0)) {
    return entries.map((e) => e.advance);
  }

  const out = entries.map((e) => e.advance);
  let tabIndex = 0;
  let off = 0;
  for (let i = 0; i < entries.length; i++) {
    if (isTabChar(entries[i]!.char)) {
      let tabOff = 0;
      while (tabOff <= off) {
        tabOff += tabStopsPx[tabIndex]!;
        tabIndex += 1;
        if (tabIndex >= tabStopsPx.length) tabIndex = 0;
      }
      out[i] = tabOff - off;
      off = 0;
      continue;
    }
    off += out[i]!;
  }
  return out;
}
