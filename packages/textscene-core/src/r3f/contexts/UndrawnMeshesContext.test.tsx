import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from './NodePathContext';
import { UndrawnMeshesProvider, useUndrawnMeshReport, useUndrawnMeshTypes } from './UndrawnMeshesContext';

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

function Types({ path }: { path: string }) {
  return <span data-testid="types">{useUndrawnMeshTypes(path).join(',')}</span>;
}

function renderTypes(children: ReactNode, path = 'Root/Wall') {
  return render(
    <UndrawnMeshesProvider>
      {children}
      <Types path={path} />
    </UndrawnMeshesProvider>
  );
}

describe('UndrawnMeshesContext', () => {
  it('lists a reported mesh type for the node that holds it', () => {
    renderTypes(<Reporter path="Root/Wall" type={UNDRAWN_TYPE} />);
    expect(screen.getByTestId('types').textContent).toBe(UNDRAWN_TYPE);
  });

  it("keeps another node's mesh types apart", () => {
    renderTypes(<Reporter path="Root/Sign" type={UNDRAWN_TYPE} />);
    expect(screen.getByTestId('types').textContent).toBe('');
  });

  it('keeps a type while any holder still reports it', () => {
    const holders = (count: number) => (
      <UndrawnMeshesProvider>
        {Array.from({ length: count }, (_, i) => (
          <Reporter key={i} path="Root/Wall" type={UNDRAWN_TYPE} />
        ))}
        <Types path="Root/Wall" />
      </UndrawnMeshesProvider>
    );
    const { rerender } = render(holders(2));
    rerender(holders(1));
    expect(screen.getByTestId('types').textContent).toBe(UNDRAWN_TYPE);
  });

  it('drops a type once its last holder lets go', () => {
    const tree = (isHeld: boolean) => (
      <UndrawnMeshesProvider>
        {isHeld && <Reporter path="Root/Wall" type={UNDRAWN_TYPE} />}
        <Types path="Root/Wall" />
      </UndrawnMeshesProvider>
    );
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(screen.getByTestId('types').textContent).toBe('');
  });
});
