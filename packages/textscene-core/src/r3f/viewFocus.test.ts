import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isViewKeyEvent, useFocusOnPointerEnter } from './viewFocus';

const added: HTMLElement[] = [];
function addToPage<T extends HTMLElement>(element: T): T {
  document.body.appendChild(element);
  added.push(element);
  return element;
}

/** A view on the page, as `useFocusOnPointerEnter` makes one. */
function focusableView(): HTMLCanvasElement {
  const view = addToPage(document.createElement('canvas'));
  renderHook(() => useFocusOnPointerEnter(view));
  return view;
}

const pointerEnter = (view: HTMLElement) => view.dispatchEvent(new PointerEvent('pointerenter'));

afterEach(() => {
  for (const element of added.splice(0)) element.remove();
});

describe('useFocusOnPointerEnter', () => {
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
});

describe('isViewKeyEvent', () => {
  function keyFrom(target: EventTarget): KeyboardEvent {
    let heard: KeyboardEvent | null = null;
    const listen = (event: Event) => (heard = event as KeyboardEvent);
    window.addEventListener('keydown', listen);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
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
