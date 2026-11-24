import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from '../contexts/NodePathContext';
import { useShaderErrorReport } from './shaderErrorReport';
import { useUndrawnReport } from './useUndrawnReport';
import { ViewStatusProvider } from './ViewStatusContext';
import { createViewStatusStore, type ViewStatusStore } from './viewStatus';

function ShaderError({ message }: { message: string | null }) {
  useShaderErrorReport(message);
  return null;
}

function EmptyShape() {
  useUndrawnReport('empty-shape');
  return null;
}

function atNode(path: string, children: ReactNode) {
  return <NodePathProvider path={path}>{children}</NodePathProvider>;
}

function inView(store: ViewStatusStore, children: ReactNode) {
  return <ViewStatusProvider store={store}>{children}</ViewStatusProvider>;
}

const shaderErrorsAt = (store: ViewStatusStore, path: string) =>
  store.status().undrawn.find((node) => node.path === `/root/${path}`)?.shaderErrors ?? [];

describe('useUndrawnReport', () => {
  it('lists a shader error for the node that holds it', () => {
    const store = createViewStatusStore();
    render(inView(store, atNode('Root/Sky', <ShaderError message="error(3): unknown identifier" />)));
    expect(shaderErrorsAt(store, 'Root/Sky')).toEqual(['error(3): unknown identifier']);
  });

  it('reports nothing for a null reason', () => {
    const store = createViewStatusStore();
    render(inView(store, atNode('Root/Sky', <ShaderError message={null} />)));
    expect(store.status().undrawn).toEqual([]);
  });

  it('reports nothing outside a node', () => {
    const store = createViewStatusStore();
    render(inView(store, <EmptyShape />));
    expect(store.status().undrawn).toEqual([]);
  });

  it('lists two errors of one node in text order', () => {
    const store = createViewStatusStore();
    render(
      inView(
        store,
        atNode(
          'Root/Sky',
          <>
            <ShaderError message="error(9): second" />
            <ShaderError message="error(1): first" />
          </>
        )
      )
    );
    expect(shaderErrorsAt(store, 'Root/Sky')).toEqual(['error(1): first', 'error(9): second']);
  });

  it('ends the report once the reporter unmounts', () => {
    const store = createViewStatusStore();
    const tree = (isMounted: boolean) =>
      inView(store, atNode('Root/Sky', isMounted && <ShaderError message="error(3): unknown identifier" />));
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(store.status().undrawn).toEqual([]);
  });
});
