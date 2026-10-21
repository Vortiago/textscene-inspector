/** `useDisposeOnRelease`: one dispose per object, after the last holder lets go. */

import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { useDisposeOnRelease } from './useDisposeOnRelease';

function Holder({ object }: { object: { dispose(): void } }) {
  useDisposeOnRelease(object);
  return null;
}

/** Lets the queued microtasks run. */
const settle = () => act(async () => Promise.resolve());

describe('useDisposeOnRelease', () => {
  it('keeps an object StrictMode releases and takes again', async () => {
    const object = { dispose: vi.fn() };
    render(
      <StrictMode>
        <Holder object={object} />
      </StrictMode>
    );
    await settle();
    expect(object.dispose).not.toHaveBeenCalled();
  });

  it('disposes the object once the holder unmounts', async () => {
    const object = { dispose: vi.fn() };
    const view = render(<Holder object={object} />);
    view.unmount();
    await settle();
    expect(object.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the object a holder replaces', async () => {
    const first = { dispose: vi.fn() };
    const view = render(<Holder object={first} />);
    view.rerender(<Holder object={{ dispose: vi.fn() }} />);
    await settle();
    expect(first.dispose).toHaveBeenCalledTimes(1);
  });
});
