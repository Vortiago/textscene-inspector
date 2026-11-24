import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from '../contexts/NodePathContext';
import { useUndrawnMeshReport } from './useUndrawnMeshReport';
import { ViewStatusProvider } from './ViewStatusContext';
import { createViewStatusStore, type ViewStatusStore } from './viewStatus';

const UNDRAWN_TYPE = 'FutureMesh';

function Reporter({ path, type }: { path: string; type: string }) {
  return (
    <NodePathProvider path={path}>
      <Report type={type} />
    </NodePathProvider>
  );
}

function Report({ type }: { type: string }) {
  useUndrawnMeshReport(type);
  return null;
}

function inView(store: ViewStatusStore, children: ReactNode) {
  return <ViewStatusProvider store={store}>{children}</ViewStatusProvider>;
}

const meshTypesAt = (store: ViewStatusStore, path: string) =>
  store.status().undrawn.find((node) => node.path === `/root/${path}`)?.meshTypes ?? [];

describe('useUndrawnMeshReport', () => {
  it('lists a reported mesh type for the node that holds it', () => {
    const store = createViewStatusStore();
    render(inView(store, <Reporter path="Root/Wall" type={UNDRAWN_TYPE} />));
    expect(meshTypesAt(store, 'Root/Wall')).toEqual([UNDRAWN_TYPE]);
  });

  it("keeps another node's mesh types apart", () => {
    const store = createViewStatusStore();
    render(inView(store, <Reporter path="Root/Sign" type={UNDRAWN_TYPE} />));
    expect(meshTypesAt(store, 'Root/Wall')).toEqual([]);
  });

  it('keeps a type while any holder still reports it', () => {
    const store = createViewStatusStore();
    const holders = (count: number) =>
      inView(
        store,
        Array.from({ length: count }, (_, i) => <Reporter key={i} path="Root/Wall" type={UNDRAWN_TYPE} />)
      );
    const { rerender } = render(holders(2));
    rerender(holders(1));
    expect(meshTypesAt(store, 'Root/Wall')).toEqual([UNDRAWN_TYPE]);
  });

  it('drops a type once its last holder lets go', () => {
    const store = createViewStatusStore();
    const tree = (isHeld: boolean) =>
      inView(store, isHeld && <Reporter path="Root/Wall" type={UNDRAWN_TYPE} />);
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(meshTypesAt(store, 'Root/Wall')).toEqual([]);
  });
});
