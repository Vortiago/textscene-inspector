/**
 * `tabAlignAdvances` — a port of `TextServer::shaped_text_tab_align`
 * (`modules/text_server_adv/text_server_adv.cpp:5688-5742`).
 */
import { describe, expect, it } from 'vitest';
import { tabAlignAdvances } from './textTabStops';

describe('tabAlignAdvances', () => {
  it('advances a tab to the next stop past the current pen offset (text_server_adv.cpp:5722-5737)', () => {
    // 'A' at 5px pen; the tab lands on the stop at 20 -> its own advance becomes 20-5=15.
    const out = tabAlignAdvances([{ char: 'A', advance: 5 }, { char: '\t', advance: 3 }], [20]);
    expect(out).toEqual([5, 15]);
  });

  it('cycles back to the first stop once every stop is behind the pen', () => {
    // pen at 25 after 'A'; stops [10, 10] cycle 10,20,30 -- the first >= 25 is 30, so advance = 30-25 = 5.
    const out = tabAlignAdvances([{ char: 'A', advance: 25 }, { char: '\t', advance: 1 }], [10, 10]);
    expect(out).toEqual([25, 5]);
  });

  it('resets the pen offset to 0 after a tab, so a second tab measures from the first (not from line start)', () => {
    const out = tabAlignAdvances(
      [{ char: '\t', advance: 1 }, { char: 'A', advance: 3 }, { char: '\t', advance: 1 }],
      [10],
    );
    // First tab: off=0 -> lands on 10 -> advance 10. 'A' -> off=3. Second tab:
    // off resets to 0 after the first tab, so off here is JUST 'A's advance (3),
    // cycling stops [10] wraps back to 10 -> tabOff must exceed 3 -> 10 -> advance 7.
    expect(out).toEqual([10, 3, 7]);
  });

  it('any non-positive stop disables alignment entirely, leaving every advance unchanged (text_server_adv.cpp:5700-5704)', () => {
    const out = tabAlignAdvances([{ char: 'A', advance: 5 }, { char: '\t', advance: 3 }], [10, 0]);
    expect(out).toEqual([5, 3]);
  });

  it('a non-tab glyph is never touched', () => {
    const out = tabAlignAdvances([{ char: 'A', advance: 5 }, { char: 'B', advance: 7 }], [10]);
    expect(out).toEqual([5, 7]);
  });
});
