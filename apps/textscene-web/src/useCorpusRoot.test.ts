/**
 * useCorpusRoot — owns the full root-switch sequence for the web previewer:
 * setResourceRoot, THREE URL modifier, and clearCaches on change.
 */
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCorpusRoot } from './useCorpusRoot';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';

function makePipeline(overrides?: Partial<{
  setResourceRoot: (root: string) => void;
  setURLModifier: (fn: (url: string) => string) => void;
  clearCaches: () => void;
}>): ResourcePipeline<WebResourceProvider> {
  const setURLModifier = overrides?.setURLModifier ?? vi.fn();
  return {
    provider: {
      setResourceRoot: overrides?.setResourceRoot ?? vi.fn(),
      loadResource: vi.fn(),
      addUploadedFile: vi.fn(),
      removeUploadedFile: vi.fn(),
    } as unknown as WebResourceProvider,
    loader: {
      clearCaches: overrides?.clearCaches ?? vi.fn(),
      eventBus: {
        getThreeManager: () => ({ setURLModifier }),
      },
    } as unknown as ResourcePipeline<WebResourceProvider>['loader'],
  };
}

describe('useCorpusRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setResourceRoot with the initial root on mount', () => {
    const setResourceRoot = vi.fn();
    const pipeline = makePipeline({ setResourceRoot });

    renderHook(() => useCorpusRoot(pipeline, 'demos/2d/platformer'));

    expect(setResourceRoot).toHaveBeenCalledWith('demos/2d/platformer');
  });

  it('installs a THREE URL modifier on mount', () => {
    const setURLModifier = vi.fn();
    const pipeline = makePipeline({ setURLModifier });

    renderHook(() => useCorpusRoot(pipeline, ''));

    expect(setURLModifier).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does NOT call clearCaches on the initial mount', () => {
    const clearCaches = vi.fn();
    const pipeline = makePipeline({ clearCaches });

    renderHook(() => useCorpusRoot(pipeline, 'demos/2d/platformer'));

    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('calls clearCaches exactly once when the root changes', () => {
    const clearCaches = vi.fn();
    const pipeline = makePipeline({ clearCaches });

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: 'demos/2d/platformer' } }
    );

    rerender({ root: 'demos/3d/fps' });

    expect(clearCaches).toHaveBeenCalledTimes(1);
  });

  it('does NOT call clearCaches when re-rendered with the same root', () => {
    const clearCaches = vi.fn();
    const pipeline = makePipeline({ clearCaches });

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: 'demos/2d/platformer' } }
    );

    rerender({ root: 'demos/2d/platformer' });

    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('updates setResourceRoot when the root changes', () => {
    const setResourceRoot = vi.fn();
    const pipeline = makePipeline({ setResourceRoot });

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: '' } }
    );

    rerender({ root: 'demos/3d/fps' });

    expect(setResourceRoot).toHaveBeenLastCalledWith('demos/3d/fps');
  });

  it('maps res:// URLs to /fixtures/ via the URL modifier using the active root', () => {
    let capturedModifier: ((url: string) => string) | undefined;
    const setURLModifier = vi.fn((fn: (url: string) => string) => {
      capturedModifier = fn;
    });
    const pipeline = makePipeline({ setURLModifier });

    renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: 'demos/2d/platformer' } }
    );

    expect(capturedModifier).toBeDefined();
    expect(capturedModifier!('res://textures/player.png')).toBe(
      '/fixtures/demos/2d/platformer/textures/player.png'
    );
  });

  it('passes non-res:// URLs through the URL modifier unchanged', () => {
    let capturedModifier: ((url: string) => string) | undefined;
    const setURLModifier = vi.fn((fn: (url: string) => string) => {
      capturedModifier = fn;
    });
    const pipeline = makePipeline({ setURLModifier });

    renderHook(() => useCorpusRoot(pipeline, ''));

    expect(capturedModifier!('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
  });
});
