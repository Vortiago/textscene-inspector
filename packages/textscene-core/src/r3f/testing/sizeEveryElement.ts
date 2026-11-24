import { vi } from 'vitest';

/** Gives every element the box `width` x `height` at the page's origin, as happy-dom lays out none. */
export function sizeEveryElement(width: number, height: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
  } as DOMRect);
}
