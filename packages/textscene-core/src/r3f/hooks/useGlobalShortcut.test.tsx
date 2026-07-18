/**
 * useGlobalShortcut — the shared window-keydown wiring behind
 * F-to-frame and Escape-deselect. The consumers' own tests cover their
 * behavior; this covers the hook's contract: key matching (case-insensitive),
 * the isTypingTarget guard, the subscribe-once ref indirection, and cleanup.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useGlobalShortcut } from './useGlobalShortcut';

function Harness({ onTrigger, shortcut = 'f' }: { onTrigger: () => void; shortcut?: string }) {
  useGlobalShortcut(shortcut, onTrigger);
  return null;
}

function pressKey(key: string, target?: EventTarget, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...init });
  (target ?? window).dispatchEvent(event);
}

describe('useGlobalShortcut', () => {
  it('fires on the bound key, case-insensitively', () => {
    const onTrigger = vi.fn();
    render(<Harness onTrigger={onTrigger} />);
    pressKey('f');
    pressKey('F');
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys', () => {
    const onTrigger = vi.fn();
    render(<Harness onTrigger={onTrigger} />);
    pressKey('g');
    pressKey('Escape');
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('ignores modifier chords — Ctrl/Cmd/Alt+key belongs to the browser/host, not us', () => {
    const onTrigger = vi.fn();
    render(<Harness onTrigger={onTrigger} />);
    pressKey('f', undefined, { ctrlKey: true }); // browser find
    pressKey('f', undefined, { metaKey: true }); // macOS find
    pressKey('f', undefined, { altKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('does not fire while the user is typing (isTypingTarget guard)', () => {
    const onTrigger = vi.fn();
    render(<Harness onTrigger={onTrigger} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    pressKey('f', input);
    expect(onTrigger).not.toHaveBeenCalled();
    input.remove();
  });

  it('always invokes the LATEST onTrigger without re-subscribing the listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness onTrigger={first} />);
    const keydownSubs = () => addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    const subsAfterMount = keydownSubs();

    rerender(<Harness onTrigger={second} />);
    pressKey('f');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(keydownSubs()).toBe(subsAfterMount); // no churn on re-render
    addSpy.mockRestore();
  });

  it('removes the listener on unmount', () => {
    const onTrigger = vi.fn();
    const { unmount } = render(<Harness onTrigger={onTrigger} />);
    unmount();
    pressKey('f');
    expect(onTrigger).not.toHaveBeenCalled();
  });
});
