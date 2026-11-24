import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import {
  ExpandedRowsProvider,
  useExpandedPaths,
  useExpandedRowActions,
  useIsExpandedRow,
  type ExpandedRowActions,
} from './expandedRows';

const useRows = () => ({ paths: useExpandedPaths(), ...useExpandedRowActions() });
const renderRows = () => renderHook(useRows, { wrapper: ExpandedRowsProvider });

describe('the expanded rows', () => {
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

  it('collapses every row on a clear', () => {
    const { result } = renderRows();
    act(() => result.current.set(new Set(['A', 'A/B'])));
    act(() => result.current.clear());
    expect(result.current.paths.size).toBe(0);
  });

  it('reveals a row by expanding each of its ancestors and keeps the others', () => {
    const { result } = renderRows();
    act(() => result.current.toggle('Other'));
    act(() => result.current.reveal('A/B/C'));
    expect([...result.current.paths].sort()).toEqual(['A', 'A/B', 'Other']);
  });

  it('renders no component that only changes the rows when a row toggles', () => {
    let renders = 0;
    let actions: ExpandedRowActions | null = null;
    function ActionsOnly() {
      renders++;
      actions = useExpandedRowActions();
      return null;
    }
    render(
      <ExpandedRowsProvider>
        <ActionsOnly />
      </ExpandedRowsProvider>
    );
    const before = renders;
    act(() => actions!.toggle('Root'));
    expect(renders).toBe(before);
  });

  it('renders only the row that a toggle opens', () => {
    const renders: Record<string, number> = { A: 0, B: 0 };
    let actions: ExpandedRowActions | null = null;
    function Row({ path }: { path: string }) {
      renders[path]!++;
      useIsExpandedRow(path);
      return null;
    }
    function Actions() {
      actions = useExpandedRowActions();
      return null;
    }
    render(
      <ExpandedRowsProvider>
        <Row path="A" />
        <Row path="B" />
        <Actions />
      </ExpandedRowsProvider>
    );
    act(() => actions!.toggle('A'));
    expect(renders).toEqual({ A: 2, B: 1 });
  });

  it('keeps its own copy of a set it is given', () => {
    const { result } = renderRows();
    const given = new Set(['A']);
    act(() => result.current.set(given));
    given.add('B');
    expect(result.current.paths.has('B')).toBe(false);
  });

  it('throws outside a provider', () => {
    expect(() => renderHook(useExpandedPaths)).toThrow(/ExpandedRowsProvider/);
    expect(() => renderHook(useExpandedRowActions)).toThrow(/ExpandedRowsProvider/);
  });
});

describe('revealing a row', () => {
  it('keeps the same set when every ancestor is expanded', () => {
    const { result } = renderRows();
    act(() => result.current.set(new Set(['Main', 'Main/Ship'])));
    const before = result.current.paths;
    act(() => result.current.reveal('Main/Ship/Engine'));
    expect(result.current.paths).toBe(before);
  });

  it('keeps the same set for the root, which has no ancestor (edge case)', () => {
    const { result } = renderRows();
    const before = result.current.paths;
    act(() => result.current.reveal('Main'));
    expect(result.current.paths).toBe(before);
  });
});
