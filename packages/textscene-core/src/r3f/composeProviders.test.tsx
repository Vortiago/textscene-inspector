/**
 * composeProviders — flattens a provider-nesting pyramid into a
 * single call. Purely a JSX-shape helper: it does NOT merge contexts
 * (ADR-0002 keeps parse/3D-render/2D-render domains separate on purpose) —
 * each entry still mounts its own, independent Provider component.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { composeProviders } from './composeProviders';

const AContext = createContext('default-a');
const BContext = createContext('default-b');

function AProvider({ value, children }: { value: string; children: ReactNode }) {
  return <AContext.Provider value={value}>{children}</AContext.Provider>;
}
function BProvider({ children }: { children: ReactNode }) {
  return <BContext.Provider value="b-value">{children}</BContext.Provider>;
}

function Consumer() {
  const a = useContext(AContext);
  const b = useContext(BContext);
  return (
    <div data-testid="consumer">
      {a}/{b}
    </div>
  );
}

describe('composeProviders', () => {
  it('nests every provider so descendants can read every context', () => {
    const Providers = composeProviders(
      (children) => <AProvider value="a-value">{children}</AProvider>,
      (children) => <BProvider>{children}</BProvider>
    );

    render(<>{Providers(<Consumer />)}</>);
    expect(screen.getByTestId('consumer').textContent).toBe('a-value/b-value');
  });

  it('preserves nesting ORDER — the first entry is the OUTERMOST provider', () => {
    const order: string[] = [];
    function Track({ name, children }: { name: string; children: ReactNode }) {
      order.push(name);
      return <>{children}</>;
    }
    const Providers = composeProviders(
      (children) => <Track name="outer">{children}</Track>,
      (children) => <Track name="middle">{children}</Track>,
      (children) => <Track name="inner">{children}</Track>
    );

    render(<>{Providers(<span>leaf</span>)}</>);
    expect(order).toEqual(['outer', 'middle', 'inner']);
  });

  it('renders the given children as the innermost content', () => {
    const Providers = composeProviders((children) => <AProvider value="x">{children}</AProvider>);
    render(<>{Providers(<div data-testid="leaf">leaf content</div>)}</>);
    expect(screen.getByTestId('leaf').textContent).toBe('leaf content');
  });

  it('works with zero providers — just renders children', () => {
    const Providers = composeProviders();
    render(<>{Providers(<div data-testid="leaf">unwrapped</div>)}</>);
    expect(screen.getByTestId('leaf').textContent).toBe('unwrapped');
  });
});
