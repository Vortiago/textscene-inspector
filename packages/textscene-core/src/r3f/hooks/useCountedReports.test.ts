/**
 * `useCountedReports` keeps a key reported while any of its reports is open, so the first of several
 * reporters to withdraw does not retire a key the others still hold.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountedReports } from './useCountedReports';

describe('useCountedReports', () => {
  it('reports a key from its first report', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => result.current.report('a'));
    expect([...result.current.reported]).toEqual(['a']);
  });

  it('keeps a key while another report of it is open', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => {
      result.current.report('a');
      result.current.report('a');
      result.current.clear('a');
    });
    expect(result.current.reported.has('a')).toBe(true);
  });

  it('drops a key when its last report is withdrawn', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => {
      result.current.report('a');
      result.current.report('a');
      result.current.clear('a');
      result.current.clear('a');
    });
    expect(result.current.reported.size).toBe(0);
  });

  it('drops a key and every open report of it at once with clearAll', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => {
      result.current.report('a');
      result.current.report('a');
      result.current.clearAll('a');
      result.current.report('a');
      result.current.clear('a');
    });
    expect(result.current.reported.size).toBe(0);
  });

  it('ignores a clear with no open report (edge case)', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => {
      result.current.clear('a');
      result.current.report('a');
    });
    expect(result.current.reported.has('a')).toBe(true);
  });

  it('reports nothing for an empty key (edge case)', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => result.current.report(''));
    expect(result.current.reported.size).toBe(0);
  });

  it('keeps its actions across a change of the set, so an effect on one does not re-run', () => {
    const { result } = renderHook(() => useCountedReports());
    const { report, clear, clearAll } = result.current;
    act(() => report('a'));
    expect([result.current.report, result.current.clear, result.current.clearAll]).toEqual([
      report,
      clear,
      clearAll,
    ]);
  });
});
