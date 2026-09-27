/**
 * The Source pane's linter surface between an edit and the debounced lint that follows it:
 * the badge counts only findings the pane shows, a gutter row or the file-level section.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSourceDiagnostics } from './useSourceDiagnostics';
import { DEBOUNCE_MS } from './useSceneSource';

/** A scene whose last line, line 4, holds a value `visible` cannot read. */
const WITH_BAD_LAST_LINE = [
  '[gd_scene format=3]',
  '',
  '[node name="Root" type="Node3D"]',
  'visible = maybe',
].join('\n');

/** The same scene with that line deleted. */
const LAST_LINE_DELETED = WITH_BAD_LAST_LINE.split('\n').slice(0, 3).join('\n');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function lintedPane(buffer: string) {
  const hook = renderHook(({ text }) => useSourceDiagnostics(text), {
    initialProps: { text: buffer },
  });
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
  return hook;
}

describe('useSourceDiagnostics', () => {
  it('puts a finding on its gutter row once the lint has run', () => {
    const { result } = lintedPane(WITH_BAD_LAST_LINE);

    expect(result.current.diagnosticsByLine.has(4)).toBe(true);
    expect(result.current.fileDiagnostics).toBeNull();
    expect(result.current.problemBadge).not.toBeNull();
  });

  it('shows a finding on a line deleted since the lint in the file-level section', () => {
    const { result, rerender } = lintedPane(WITH_BAD_LAST_LINE);
    const finding = result.current.diagnosticsByLine.get(4)!.messages;

    rerender({ text: LAST_LINE_DELETED });

    expect(result.current.lineCount).toBe(3);
    expect(result.current.diagnosticsByLine.has(4)).toBe(false);
    expect(result.current.fileDiagnostics?.messages).toEqual(finding);
    expect(result.current.problemBadge).not.toBeNull();
  });

  it('drops the finding when the lint of the edited text runs', () => {
    const { result, rerender } = lintedPane(WITH_BAD_LAST_LINE);

    rerender({ text: LAST_LINE_DELETED });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(result.current.fileDiagnostics).toBeNull();
    expect(result.current.problemBadge).toBeNull();
  });
});
