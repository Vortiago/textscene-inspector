import { describe, it, expect } from 'vitest';
import {
  TAB_BAR_ALIGNMENT_HINT_NAMES,
  TAB_BAR_ALIGNMENT_NAMES,
  TAB_BAR_CLOSE_BUTTON_DISPLAY_POLICY_NAMES,
  TAB_CONTAINER_TABS_POSITION_NAMES,
} from './tabs.js';

describe('tab names', () => {
  it('names each tab alignment by its constant, ALIGNMENT_MAX left out', () => {
    expect(TAB_BAR_ALIGNMENT_NAMES).toEqual({ 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT' });
  });

  it('names each tab alignment as `tab_container.cpp:1208` hints it', () => {
    expect(TAB_BAR_ALIGNMENT_HINT_NAMES).toEqual({ 0: 'Left', 1: 'Center', 2: 'Right' });
  });

  it('names each close button policy without its CLOSE_BUTTON prefix', () => {
    expect(TAB_BAR_CLOSE_BUTTON_DISPLAY_POLICY_NAMES).toEqual({
      0: 'SHOW_NEVER',
      1: 'SHOW_ACTIVE_ONLY',
      2: 'SHOW_ALWAYS',
    });
  });

  it('names each tabs position as `tab_container.cpp:1210` hints it', () => {
    expect(TAB_CONTAINER_TABS_POSITION_NAMES).toEqual({ 0: 'Top', 1: 'Bottom' });
  });
});
