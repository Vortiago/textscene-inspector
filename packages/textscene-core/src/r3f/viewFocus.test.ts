import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isViewKeyEvent, useViewFocus } from './viewFocus';

const added: HTMLElement[] = [];
function addToPage<T extends HTMLElement>(element: T): T {
  document.body.appendChild(element);
  added.push(element);
  return element;
}

/** A view on the page, as `useViewFocus` makes one. */
function focusableView(): HTMLCanvasElement {
  const view = addToPage(document.createElement('canvas'));
  renderHook(() => useViewFocus(view));
  return view;
}

const pointerEnter = (view: HTMLElement) => view.dispatchEvent(new PointerEvent('pointerenter'));

afterEach(() => {
  for (const element of added.splice(0)) element.remove();
  vi.restoreAllMocks();
});

describe('useViewFocus', () => {
  it('gives the view focus from a button that held it', () => {
    const view = focusableView();
    addToPage(document.createElement('button')).focus();

    pointerEnter(view);

    expect(document.activeElement).toBe(view);
  });

  it('leaves focus in a text field', () => {
    const view = focusableView();
    const field = addToPage(document.createElement('input'));
    field.focus();

    pointerEnter(view);

    expect(document.activeElement).toBe(field);
  });

  it('gives the view focus from a checkbox, which takes no typed text', () => {
    const view = focusableView();
    const checkbox = addToPage(document.createElement('input'));
    checkbox.type = 'checkbox';
    checkbox.focus();

    pointerEnter(view);

    expect(document.activeElement).toBe(view);
  });

  it('takes no focus while another document holds the keys', () => {
    const view = focusableView();
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    pointerEnter(view);

    expect(document.activeElement).not.toBe(view);
  });

  it('gives the view focus on a click, even from a text field', () => {
    const view = focusableView();
    addToPage(document.createElement('input')).focus();

    view.dispatchEvent(new PointerEvent('pointerdown'));

    expect(document.activeElement).toBe(view);
  });

  it('puts the view in the tab order', () => {
    expect(focusableView().tabIndex).toBe(0);
  });
});

describe('isViewKeyEvent', () => {
  function keyFrom(target: EventTarget): KeyboardEvent {
    let heard: KeyboardEvent | null = null;
    const listen = (event: Event) => (heard = event as KeyboardEvent);
    window.addEventListener('keydown', listen);
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
    window.removeEventListener('keydown', listen);
    if (!heard) throw new Error('expected the keydown to reach the window, got none');
    return heard;
  }

  it('is true for a key sent to the view', () => {
    const view = focusableView();
    expect(isViewKeyEvent(keyFrom(view), view)).toBe(true);
  });

  it('is false for a key sent to the page', () => {
    const view = focusableView();
    expect(isViewKeyEvent(keyFrom(document.body), view)).toBe(false);
  });
});
