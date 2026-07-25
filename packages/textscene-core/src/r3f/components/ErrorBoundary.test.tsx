/**
 * ErrorBoundary — the shared class component both PreviewErrorBoundary
 * (around <ViewportArea>) and NodeDispatcher's per-node catch reuse. Plain
 * react-dom render here since error-boundary semantics are renderer-agnostic
 * (a core React feature, not R3F-specific); NodeDispatcher.test.tsx pins the
 * R3F/per-node usage separately.
 */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('kaboom');
  return <div>safe content</div>;
}

/** Lets a test flip `shouldThrow` after the initial render (to exercise reset). */
function BombHarness({ initialShouldThrow }: { initialShouldThrow: boolean }) {
  const [shouldThrow, setShouldThrow] = useState(initialShouldThrow);
  return (
    <ErrorBoundary fallback={(error, reset) => (
      <div>
        <span data-testid="error-message">{error.message}</span>
        <button
          type="button"
          onClick={() => {
            setShouldThrow(false);
            reset();
          }}
        >
          Retry
        </button>
      </div>
    )}>
      <Bomb shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('safe content')).toBeDefined();
  });

  it('renders the fallback when a child throws during render', () => {
    // React logs the thrown error to console.error twice (dev double-log);
    // silence it so the test output isn't noisy with an expected throw.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={(error) => <div data-testid="fallback">{error.message}</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('fallback').textContent).toBe('kaboom');
    expect(screen.queryByText('safe content')).toBeNull();

    consoleSpy.mockRestore();
  });

  it('calls onError with the caught error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary fallback={() => <div>fallback</div>} onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toBe('kaboom');

    consoleSpy.mockRestore();
  });

  it('reset() re-renders children after the caller stops the crashing condition', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<BombHarness initialShouldThrow={true} />);
    expect(screen.getByTestId('error-message').textContent).toBe('kaboom');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(screen.getByText('safe content')).toBeDefined();
    expect(screen.queryByTestId('error-message')).toBeNull();

    consoleSpy.mockRestore();
  });

  it('resetKeys: clears a caught error when a resetKey changes, WITHOUT remounting the boundary itself', () => {
    // Mirrors PreviewErrorBoundary's "clears when the file is fixed" contract
    // — the fix arrives as new props (a fresh sceneGraph), not a user
    // click, and must NOT force a remount of everything the boundary wraps
    // (that would drop viewport camera state / playback state on every
    // edit, not just a crash recovery).
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Harness({ resetKey, shouldThrow }: { resetKey: string; shouldThrow: boolean }) {
      return (
        <ErrorBoundary
          fallback={(error) => <div data-testid="fallback">{error.message}</div>}
          resetKeys={[resetKey]}
        >
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    const { rerender } = render(<Harness resetKey="v1" shouldThrow={true} />);
    expect(screen.getByTestId('fallback')).toBeDefined();

    // Same resetKey, still throwing: stays on the fallback.
    rerender(<Harness resetKey="v1" shouldThrow={true} />);
    expect(screen.getByTestId('fallback')).toBeDefined();

    // A NEW resetKey (the "fixed" scene) — even though the child still WOULD
    // throw if given the chance, the boundary clears and re-renders children,
    // which is what proves the reset happened via props, not a remount.
    rerender(<Harness resetKey="v2" shouldThrow={false} />);
    expect(screen.queryByTestId('fallback')).toBeNull();
    expect(screen.getByText('safe content')).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('isolates a crash to its own boundary — a sibling boundary is unaffected', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <>
        <ErrorBoundary fallback={() => <div data-testid="fallback-a">broken A</div>}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
        <ErrorBoundary fallback={() => <div data-testid="fallback-b">broken B</div>}>
          <Bomb shouldThrow={false} />
        </ErrorBoundary>
      </>
    );

    expect(screen.getByTestId('fallback-a')).toBeDefined();
    expect(screen.getByText('safe content')).toBeDefined();
    expect(screen.queryByTestId('fallback-b')).toBeNull();

    consoleSpy.mockRestore();
  });
});
