import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './isTypingTarget';

function makeElement(tag: string, contentEditable = false): HTMLElement {
  const el = document.createElement(tag);
  if (contentEditable) el.contentEditable = 'true';
  return el;
}

describe('isTypingTarget', () => {
  it('returns true for an <input>', () => {
    expect(isTypingTarget(makeElement('input'))).toBe(true);
  });

  it('returns true for a <textarea> (the web app Source pane)', () => {
    expect(isTypingTarget(makeElement('textarea'))).toBe(true);
  });

  it('returns true for a contentEditable element', () => {
    expect(isTypingTarget(makeElement('div', true))).toBe(true);
  });

  it('returns false for a plain <div>', () => {
    expect(isTypingTarget(makeElement('div'))).toBe(false);
  });

  it('returns false for a <canvas> (the 3D viewport)', () => {
    expect(isTypingTarget(makeElement('canvas'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTypingTarget(null)).toBe(false);
  });

  it('returns false for a non-HTMLElement EventTarget', () => {
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});
