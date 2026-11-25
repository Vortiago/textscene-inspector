import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '../nodes/index';
import { useNoComponentReport } from './useNoComponentReport';
import { ViewStatusProvider } from './ViewStatusContext';
import { createViewStatusStore, type ViewStatusStore } from './viewStatus';

function Reporter({ path, type }: { path: string; type: string }) {
  useNoComponentReport(path, type);
  return null;
}

const hasNoComponentAt = (store: ViewStatusStore, path: string) =>
  store.status().undrawn.find((node) => node.path === `/root/${path}`)?.hasNoComponent ?? false;

describe('useNoComponentReport', () => {
  it('reports a node whose type has no component', () => {
    const store = createViewStatusStore();
    render(
      <ViewStatusProvider store={store}>
        <Reporter path="Main/Mystery" type="TotallyUnknownType" />
      </ViewStatusProvider>
    );
    expect(hasNoComponentAt(store, 'Main/Mystery')).toBe(true);
  });

  it('reports nothing for a type a component draws', () => {
    const store = createViewStatusStore();
    render(
      <ViewStatusProvider store={store}>
        <Reporter path="Main/Box" type="MeshInstance3D" />
      </ViewStatusProvider>
    );
    expect(store.status().undrawn).toEqual([]);
  });

  it('ends the report once the node leaves the view', () => {
    const store = createViewStatusStore();
    const view = (isHeld: boolean) => (
      <ViewStatusProvider store={store}>
        {isHeld && <Reporter path="Main/Mystery" type="TotallyUnknownType" />}
      </ViewStatusProvider>
    );
    const { rerender } = render(view(true));
    rerender(view(false));
    expect(store.status().undrawn).toEqual([]);
  });
});
