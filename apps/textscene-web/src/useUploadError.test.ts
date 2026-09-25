/**
 * The toolbar's one error banner over two channels: it shows the error set most recently,
 * and a load failure counts as new each time one arrives, even with an unchanged message.
 * Set order is the order the errors were set in, whatever order they render in.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUploadError } from './useUploadError';
import { nextErrorSequence } from './errorSequence';
import type { LoadError } from './useSceneSource';

const NOT_FOUND = 'Failed to load fixture: Not Found';
const NO_TSCN = 'No .tscn file found among the dropped/selected files.';

/** A fetch failure set now, as `useSceneSource` sets one. */
function loadFailure(message: string): LoadError {
  return { message, sequence: nextErrorSequence() };
}

function renderChannel(initial: LoadError | null = null) {
  return renderHook(({ loadError }) => useUploadError(loadError), {
    initialProps: { loadError: initial },
  });
}

describe('useUploadError', () => {
  it('shows no error while neither channel is set', () => {
    const { result } = renderChannel();
    expect(result.current.effectiveError).toBeNull();
  });

  it('shows a load failure', () => {
    const { result } = renderChannel(loadFailure(NOT_FOUND));
    expect(result.current.effectiveError).toBe(NOT_FOUND);
  });

  it('shows an upload error reported after a load failure', () => {
    const { result } = renderChannel(loadFailure(NOT_FOUND));

    act(() => result.current.reportUploadError(NO_TSCN));

    expect(result.current.effectiveError).toBe(NO_TSCN);
  });

  it('shows a load failure that arrives after an upload error', () => {
    const { result, rerender } = renderChannel();
    act(() => result.current.reportUploadError(NO_TSCN));

    rerender({ loadError: loadFailure(NOT_FOUND) });

    expect(result.current.effectiveError).toBe(NOT_FOUND);
  });

  it('shows a retry that fails with the same message over the upload error before it', () => {
    // No null render between the two failures: React can batch the fetch's reset with its
    // rejection, so only the failure's own sequence tells the retry apart.
    const { result, rerender } = renderChannel(loadFailure(NOT_FOUND));
    act(() => result.current.reportUploadError(NO_TSCN));

    rerender({ loadError: loadFailure(NOT_FOUND) });

    expect(result.current.effectiveError).toBe(NOT_FOUND);
  });

  it('keeps the upload error when a re-render carries the same failure again', () => {
    const failure = loadFailure(NOT_FOUND);
    const { result, rerender } = renderChannel(failure);
    act(() => result.current.reportUploadError(NO_TSCN));

    rerender({ loadError: failure });

    expect(result.current.effectiveError).toBe(NO_TSCN);
  });

  it('falls back to the live upload error when the newer load failure clears', () => {
    const { result, rerender } = renderChannel();
    act(() => result.current.reportUploadError(NO_TSCN));
    rerender({ loadError: loadFailure(NOT_FOUND) });

    rerender({ loadError: null });

    expect(result.current.effectiveError).toBe(NO_TSCN);
  });

  it('falls back to the live load failure when the newer upload error clears', () => {
    const { result } = renderChannel(loadFailure(NOT_FOUND));
    act(() => result.current.reportUploadError(NO_TSCN));

    act(() => result.current.clearUploadError());

    expect(result.current.effectiveError).toBe(NOT_FOUND);
  });

  it('shows an upload error reported after a load failure that renders later', () => {
    // A fetch can reject, and the drop after it can render first.
    const { result, rerender } = renderChannel();
    const failure = loadFailure(NOT_FOUND);
    act(() => result.current.reportUploadError(NO_TSCN));

    rerender({ loadError: failure });

    expect(result.current.effectiveError).toBe(NO_TSCN);
  });

  it('shows an upload error reported in the same batch as an earlier load failure', () => {
    const { result, rerender } = renderChannel();

    act(() => {
      rerender({ loadError: loadFailure(NOT_FOUND) });
      result.current.reportUploadError(NO_TSCN);
    });

    expect(result.current.effectiveError).toBe(NO_TSCN);
  });
});
