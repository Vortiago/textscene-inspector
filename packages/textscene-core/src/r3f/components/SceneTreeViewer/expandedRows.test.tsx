import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ExpandedRowsProvider, useExpandedRows } from './expandedRows';

const renderRows = () => renderHook(useExpandedRows, { wrapper: ExpandedRowsProvider });

describe('useExpandedRows', () => {
  it('starts with every row collapsed', () => {
    expect(renderRows().result.current.paths.size).toBe(0);
  });

  it('toggles one row open and shut', () => {
    const { result } = renderRows();
    act(() => result.current.toggle('Root'));
    expect(result.current.paths.has('Root')).toBe(true);
    act(() => result.current.toggle('Root'));
    expect(result.current.paths.has('Root')).toBe(false);
  });

  it('replaces the whole set', () => {
    const { result } = renderRows();
    act(() => result.current.set(new Set(['A', 'A/B'])));
    act(() => result.current.set(new Set(['C'])));
    expect([...result.current.paths]).toEqual(['C']);
  });

  it('reveals a row by expanding each of its ancestors and keeps the others', () => {
    const { result } = renderRows();
    act(() => result.current.toggle('Other'));
    act(() => result.current.reveal('A/B/C'));
    expect([...result.current.paths].sort()).toEqual(['A', 'A/B', 'Other']);
  });

  it('keeps the same set when a reveal finds every ancestor expanded', () => {
    const { result } = renderRows();
    act(() => result.current.reveal('A/B'));
    const before = result.current.paths;
    act(() => result.current.reveal('A/B'));
    expect(result.current.paths).toBe(before);
  });

  it('throws outside a provider', () => {
    expect(() => renderHook(useExpandedRows)).toThrow(/ExpandedRowsProvider/);
  });
});
