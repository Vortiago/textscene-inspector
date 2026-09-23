/**
 * A drag reports a clamped width through setWidth, and `invert` flips the
 * direction. A controlled wrapper feeds the width back, since the delta is
 * relative to the width at pointer-down.
 */

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Splitter } from './Splitter';

function Harness({ initial = 300, invert = false, min = 180, max = 560 }) {
  const [w, setW] = useState(initial);
  return (
    <>
      <span data-testid="w">{w}</span>
      <Splitter width={w} setWidth={setW} invert={invert} min={min} max={max} label="resize" />
    </>
  );
}

function handle() {
  return screen.getByRole('separator', { name: 'resize' });
}
function widthValue() {
  return Number(screen.getByTestId('w').textContent);
}

describe('Splitter', () => {
  it('renders a vertical separator with the given label', () => {
    render(<Harness />);
    const h = handle();
    expect(h.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('dragging right widens a left-edge dock by the pointer delta', () => {
    render(<Harness initial={300} />);
    fireEvent.pointerDown(handle(), { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 160, pointerId: 1 }); // +60
    expect(widthValue()).toBe(360);
    fireEvent.pointerUp(handle(), { clientX: 160, pointerId: 1 });
  });

  it('inverts the direction for a right-edge dock (drag left widens)', () => {
    render(<Harness initial={300} invert />);
    fireEvent.pointerDown(handle(), { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 150, pointerId: 1 }); // -50, inverted to +50
    expect(widthValue()).toBe(350);
  });

  it('clamps to max and min', () => {
    render(<Harness initial={300} min={200} max={400} />);
    const h = handle();
    fireEvent.pointerDown(h, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(h, { clientX: 999, pointerId: 1 }); // way past max
    expect(widthValue()).toBe(400);
    fireEvent.pointerMove(h, { clientX: -999, pointerId: 1 }); // way past min
    expect(widthValue()).toBe(200);
  });

  it('ignores pointer move when no drag is in progress', () => {
    render(<Harness initial={300} />);
    fireEvent.pointerMove(handle(), { clientX: 500, pointerId: 1 });
    expect(widthValue()).toBe(300);
  });
});
