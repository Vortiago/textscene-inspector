import { describe, expect, it } from 'vitest';
import { resolveVisibleChars } from './visibleChars';

describe('resolveVisibleChars', () => {
  it('multiplies the total and the ratio in single precision, as `get_total_character_count() * p_ratio` does', () => {
    // 44 * 0.6818181818181818 in double precision is 29.999999999999996, which truncates to 29. Godot's float gives 30.
    expect(resolveVisibleChars({ visible_ratio: String(30 / 44) }, () => 44)?.visibleChars).toBe(30);
  });
});
