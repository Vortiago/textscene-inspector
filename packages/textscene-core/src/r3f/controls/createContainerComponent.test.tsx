/**
 * createContainerComponent folds the shared container ceremony (cast props →
 * read parent kind → merge controlLayoutStyle with a container-specific style →
 * wrap children in a typed <div> + ControlParentProvider) into one factory.
 * Each container is then just a config: typeName + child layout kind + style.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createContainerComponent } from './createContainerComponent';
import { useControlParent } from './ControlParentContext';
import type { TscnNode } from '../../parser/types';

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function node(name: string): TscnNode {
  return {
    name,
    type: 'TestRow',
    children: [],
    properties: { name } as TscnNode['properties'],
  };
}

const Row = createContainerComponent({
  typeName: 'TestRow',
  kind: 'row',
  useStyle: () => ({ display: 'flex', flexDirection: 'row', gap: '7px' }),
});

describe('createContainerComponent', () => {
  it('renders a <div> tagged with the control type and node name', () => {
    const { container } = render(<Row node={node('Box')} />);
    const div = container.querySelector('[data-control-type="TestRow"]') as HTMLElement;
    expect(div).toBeTruthy();
    expect(div.getAttribute('data-node-name')).toBe('Box');
  });

  it('merges the container-specific style on top of the layout style', () => {
    const { container } = render(<Row node={node('Box')} />);
    const div = container.querySelector('[data-control-type="TestRow"]') as HTMLElement;
    expect(div.style.display).toBe('flex');
    expect(div.style.gap).toBe('7px');
  });

  it('provides the configured layout kind to its children', () => {
    const { getByTestId } = render(
      <Row node={node('Box')}>
        <KindProbe />
      </Row>
    );
    expect(getByTestId('kind').textContent).toBe('row');
  });

  it('names the component after its typeName for DevTools', () => {
    expect(Row.displayName).toBe('TestRow');
  });
});
