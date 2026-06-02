/**
 * A MarginContainer stretches its single child to fill the padded box (Godot
 * container semantics). The overlay's MarginContainer is a flex column, so its
 * child must flex-grow to fill the height — without this the child sat at its
 * natural content height and inner EXPAND rows had no room to grow (the
 * DialogSystem dialog rendered tiny/clustered, not filling the bar).
 */
import { describe, it, expect } from 'vitest';
import { controlLayoutStyle } from './controlLayout';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';

const props = (p: Partial<ControlProperties> = {}): ControlProperties =>
  ({ name: 'Child', ...p }) as ControlProperties;

describe('controlLayoutStyle — MarginContainer child fills the padded box', () => {
  it('a margin-parented child grows to fill (height) and stretches (width)', () => {
    const s = controlLayoutStyle(props(), 'margin');
    expect(s.flexGrow).toBe(1);
    expect(s.alignSelf).toBe('stretch');
    expect(s.minHeight).toBe(0);
  });
});
