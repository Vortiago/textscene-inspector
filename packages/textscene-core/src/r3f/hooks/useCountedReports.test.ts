import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountedReports } from './useCountedReports';

describe('useCountedReports', () => {
  it('renders the reported set again on a report', () => {
    const { result } = renderHook(() => useCountedReports());
    act(() => result.current.report('a'));
    expect([...result.current.reported]).toEqual(['a']);
  });

  it('keeps its actions across a change of the set, so an effect on one does not re-run', () => {
    const { result } = renderHook(() => useCountedReports());
    const { report, clear } = result.current;
    act(() => report('a'));
    expect([result.current.report, result.current.clear]).toEqual([report, clear]);
  });
});
