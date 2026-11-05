import { describe, expect, it } from 'vitest';
import { resolveVisibleChars } from './visibleChars';

describe('resolveVisibleChars', () => {
  it('multiplies the total and the ratio in single precision, as `get_total_character_count() * p_ratio` does', () => {
    // 44 * 0.6818181818181818 in double precision is 29.999999999999996, which truncates to 29. Godot's float gives 30.
    expect(resolveVisibleChars({ visible_ratio: String(30 / 44) }, () => 44)?.visibleChars).toBe(30);
  });

  it('resets the ratio on empty text for Label and keeps it for RichTextLabel', () => {
    const properties = { visible_ratio: '0.5', visible_characters: '3' };
    expect(resolveVisibleChars(properties, () => 0)?.visibleRatio).toBe(1);
    expect(resolveVisibleChars(properties, () => 0, true)?.visibleRatio).toBe(0.5);
  });
});
