/**
 * useCorpusRoot — owns the full root-switch sequence for the web previewer:
 * setResourceRoot, THREE URL modifier, and clearCaches on change.
 */
// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { switchCorpusRoot, useCorpusRoot } from './useCorpusRoot';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';

function makePipeline() {
  const setResourceRoot = vi.fn<(root: string) => void>();
  const setURLModifier = vi.fn<(modify: (url: string) => string) => void>();
  const clearCaches = vi.fn<() => void>();
  const pipeline: ResourcePipeline<WebResourceProvider> = {
    provider: { setResourceRoot } as unknown as WebResourceProvider,
    loader: {
      clearCaches,
      eventBus: {
        getThreeManager: () => ({ setURLModifier }),
      },
    } as unknown as ResourcePipeline<WebResourceProvider>['loader'],
  };
  return { pipeline, setResourceRoot, setURLModifier, clearCaches };
}

describe('switchCorpusRoot', () => {
  it('routes the provider and the URL modifier to the new root synchronously', () => {
    const { pipeline, setResourceRoot, setURLModifier } = makePipeline();

    switchCorpusRoot(pipeline, 'demos/2d/platformer');

    expect(setResourceRoot).toHaveBeenCalledWith('demos/2d/platformer');
    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('res://textures/player.png')).toBe(
      '/fixtures/demos/2d/platformer/textures/player.png'
    );
  });

  it('never clears caches itself — that stays with useCorpusRoot', () => {
    const { pipeline, clearCaches } = makePipeline();

    switchCorpusRoot(pipeline, 'demos/3d/fps');

    expect(clearCaches).not.toHaveBeenCalled();
  });
});

describe('useCorpusRoot', () => {
  it('calls setResourceRoot with the initial root on mount', () => {
    const { pipeline, setResourceRoot } = makePipeline();

    renderHook(() => useCorpusRoot(pipeline, 'demos/2d/platformer'));

    expect(setResourceRoot).toHaveBeenCalledWith('demos/2d/platformer');
  });

  it('installs a THREE URL modifier on mount', () => {
    const { pipeline, setURLModifier } = makePipeline();

    renderHook(() => useCorpusRoot(pipeline, ''));

    expect(setURLModifier).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does NOT call clearCaches on the initial mount', () => {
    const { pipeline, clearCaches } = makePipeline();

    renderHook(() => useCorpusRoot(pipeline, 'demos/2d/platformer'));

    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('calls clearCaches exactly once when the root changes', () => {
    const { pipeline, clearCaches } = makePipeline();

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: 'demos/2d/platformer' } }
    );

    rerender({ root: 'demos/3d/fps' });

    expect(clearCaches).toHaveBeenCalledTimes(1);
  });

  it('does NOT call clearCaches when re-rendered with the same root', () => {
    const { pipeline, clearCaches } = makePipeline();

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: 'demos/2d/platformer' } }
    );

    rerender({ root: 'demos/2d/platformer' });

    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('updates setResourceRoot when the root changes', () => {
    const { pipeline, setResourceRoot } = makePipeline();

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: '' } }
    );

    rerender({ root: 'demos/3d/fps' });

    expect(setResourceRoot).toHaveBeenLastCalledWith('demos/3d/fps');
  });

  it('maps res:// URLs to /fixtures/ via the URL modifier using the active root', () => {
    const { pipeline, setURLModifier } = makePipeline();

    renderHook(() => useCorpusRoot(pipeline, 'demos/2d/platformer'));

    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('res://textures/player.png')).toBe(
      '/fixtures/demos/2d/platformer/textures/player.png'
    );
  });

  it('remaps res:// URLs with the new root after a root change', () => {
    const { pipeline, setURLModifier } = makePipeline();

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useCorpusRoot(pipeline, root),
      { initialProps: { root: 'demos/2d/platformer' } }
    );

    rerender({ root: 'demos/3d/fps' });

    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('res://textures/player.png')).toBe(
      '/fixtures/demos/3d/fps/textures/player.png'
    );
  });

  it('passes non-res:// URLs through the URL modifier unchanged', () => {
    const { pipeline, setURLModifier } = makePipeline();

    renderHook(() => useCorpusRoot(pipeline, ''));

    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
  });
});
