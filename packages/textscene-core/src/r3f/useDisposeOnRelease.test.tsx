/** `useDisposeOnRelease` and `holdUntilReleased`: one dispose per object, after the last holder lets go. */

import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { holdUntilReleased, isHeld, useDisposeOnRelease } from './useDisposeOnRelease';

function Holder({ object }: { object: { dispose(): void } }) {
  useDisposeOnRelease(object);
  return null;
}

function TwoHolders({ object }: { object: { dispose(): void } }) {
  useDisposeOnRelease(object);
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

  it('disposes an object once when two holders let go in the same task', async () => {
    const object = { dispose: vi.fn() };
    const view = render(<TwoHolders object={object} />);
    view.unmount();
    await settle();
    expect(object.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('holdUntilReleased', () => {
  it('is held from the first hold until the last release', () => {
    const object = { dispose: vi.fn() };
    const releaseFirst = holdUntilReleased(object);
    const releaseSecond = holdUntilReleased(object);
    expect(isHeld(object)).toBe(true);
    releaseFirst();
    expect(isHeld(object)).toBe(true);
    releaseSecond();
    expect(isHeld(object)).toBe(false);
  });

  it('counts a release once, however often it is called', () => {
    const object = { dispose: vi.fn() };
    const release = holdUntilReleased(object);
    const stillHeld = holdUntilReleased(object);
    release();
    release();
    expect(isHeld(object)).toBe(true);
    stillHeld();
  });

  it('disposes the object once after the last release, when the task ends', async () => {
    const object = { dispose: vi.fn() };
    const releaseFirst = holdUntilReleased(object);
    const releaseSecond = holdUntilReleased(object);
    releaseFirst();
    releaseSecond();
    expect(object.dispose).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(object.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps an object that is held again in the task it was released', async () => {
    const object = { dispose: vi.fn() };
    holdUntilReleased(object)();
    holdUntilReleased(object);
    await Promise.resolve();
    expect(object.dispose).not.toHaveBeenCalled();
  });

  it('is not held before any hold', () => {
    expect(isHeld({ dispose: vi.fn() })).toBe(false);
  });
});
