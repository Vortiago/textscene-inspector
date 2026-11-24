import { describe, expect, it } from 'vitest';
import { isFocusOriginKey, isFocusSelectionKey, isFrameSelectionKey } from './editorKeyBindings';

const keyDown = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('the focus keys', () => {
  it('match the physical F on a layout without Latin letters', () => {
    expect(isFocusSelectionKey(keyDown({ code: 'KeyF', key: 'а' }))).toBe(true);
  });

  it('match the physical O on a layout without Latin letters', () => {
    expect(isFocusOriginKey(keyDown({ code: 'KeyO', key: 'щ' }))).toBe(true);
  });

  it('take no F held with Ctrl, a chord of the page', () => {
    expect(isFocusSelectionKey(keyDown({ code: 'KeyF', key: 'f', ctrlKey: true }))).toBe(false);
  });

  it('tell a bare F from Shift+F', () => {
    const shiftF = keyDown({ code: 'KeyF', key: 'F', shiftKey: true });
    expect([isFocusSelectionKey(shiftF), isFrameSelectionKey(shiftF)]).toEqual([false, true]);
  });
});
