/**
 * A render-time error boundary for an exception thrown in render, such as NaN in
 * a BufferGeometry. R3F mounts its scene in a separate reconciler root, which an
 * outer boundary cannot catch, so the same class serves `PreviewErrorBoundary`
 * and `NodeDispatcher`'s per-node catch.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as logger from '../../logger.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Rendered instead of `children` once an error is caught. `reset()` clears the
   * caught state and re-renders `children` from scratch.
   */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Fired once per catch, for example to show the error elsewhere in the UI. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * When any entry changes (`Object.is`) while an error is caught, clear it: a
   * props update, not a `key` remount, which would rebuild the wrapped tree and
   * lose camera and playback state on every scene change.
   */
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
