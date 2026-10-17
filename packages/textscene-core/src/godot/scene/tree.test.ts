import { describe, it, expect } from 'vitest';
import { TREE_DROP_MODE_FLAG_NAMES, TREE_SCROLL_HINT_MODE_NAMES, TREE_SELECT_MODE_NAMES } from './tree.js';

describe('Tree names', () => {
  it('names each select mode by its constant', () => {
    expect(TREE_SELECT_MODE_NAMES).toEqual({
      0: 'SELECT_SINGLE',
      1: 'SELECT_ROW',
      2: 'SELECT_MULTI',
    });
  });

  it('names each drop mode bit, DROP_MODE_DISABLED (0) left out', () => {
    expect(TREE_DROP_MODE_FLAG_NAMES).toEqual({ 1: 'DROP_MODE_ON_ITEM', 2: 'DROP_MODE_INBETWEEN' });
  });

  it('names each scroll hint mode by its constant', () => {
    expect(TREE_SCROLL_HINT_MODE_NAMES).toEqual({
      0: 'SCROLL_HINT_MODE_DISABLED',
      1: 'SCROLL_HINT_MODE_BOTH',
      2: 'SCROLL_HINT_MODE_TOP',
      3: 'SCROLL_HINT_MODE_BOTTOM',
    });
  });
});
