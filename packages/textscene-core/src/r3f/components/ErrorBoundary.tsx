/**
 * Generic render-time error boundary.
 *
 * The architecture invests heavily in graceful degradation for RESOLUTION
 * failures (fallback cubes, missing-resource placeholders) but had nothing
 * catching an actual THROWN exception during render (NaN into a
 * BufferGeometry, an unexpected GLB structure) — one bad node blanked the
 * entire preview in both apps.
 *
 * Renderer-agnostic: `componentDidCatch`/`getDerivedStateFromError` are a
 * core React feature, not specific to react-dom, so the SAME class works
 * both in the outer DOM tree (`PreviewErrorBoundary` around `<ViewportArea>`)
 * and inside `<Canvas>`'s own React root (`NodeDispatcher`'s per-node catch)
 * — R3F mounts its scene tree via a separate `react-reconciler` root, so an
 * outer, DOM-tree boundary can never catch an error thrown by a component
 * rendered inside `<Canvas>`; each tree needs its own boundary.
 *
 * `fallback` is a render-prop (not a plain ReactNode) so callers can show
 * the caught error and/or offer a retry via the supplied `reset()`, which
 * clears the caught state and re-renders `children` from scratch.
 *
 * `resetKeys` (mirrors the `react-error-boundary` convention) clears a
 * caught error the moment any entry changes (`Object.is` per-entry), via
 * `componentDidUpdate` — a normal props update, NOT a `key`-driven remount.
 * `PreviewErrorBoundary` passes `[sceneGraph]` so a crash clears the instant
 * a fixed file re-parses. A `key`-based remount would work too but would
 * also tear down and rebuild everything the boundary wraps (losing
 * OrbitControls camera state / animation playback state) on EVERY scene
 * change, not just when recovering from a crash.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as logger from '../../logger.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of `children` once an error is caught. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Fired once per catch — e.g. to surface the error elsewhere in the UI. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** When any entry changes (`Object.is`) while an error is caught, clear it. */
  resetKeys?: readonly unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('[ErrorBoundary] render crashed:', error, info.componentStack ?? '');
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.error) return;
    const prevKeys = prevProps.resetKeys;
    const keys = this.props.resetKeys;
    if (!keys || keys.length !== prevKeys?.length) return;
    const changed = keys.some((key, i) => !Object.is(key, prevKeys[i]));
    if (changed) this.reset();
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return this.props.fallback(error, this.reset);
    }
    return this.props.children;
  }
}
