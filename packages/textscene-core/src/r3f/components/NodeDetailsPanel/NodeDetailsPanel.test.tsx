import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { TscnNode } from '../../../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function panelWrap(graph = createSceneGraphFromTscnScene({ nodes: [] })) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>{children}</SelectionProvider>
      </HierarchyProvider>
    );
  };
}

function Selector({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  return (
    <button data-testid="select-node" onClick={() => setSelectedNodePath(path)}>
      select
    </button>
  );
}

const FAKE_TYPE = '___PanelTestType___';

afterEach(() => {
  // Cleanup any registrations the tests added so they don't leak.
  const registrationsAny = (nodeRegistry as unknown as {
    registrations: Map<string, NodeTypeRegistration>;
  }).registrations;
  registrationsAny.delete(FAKE_TYPE);
});

describe('<NodeDetailsPanel>', () => {
  it('shows empty-state copy when nothing is selected', () => {
    render(<NodeDetailsPanel />, { wrapper: panelWrap() });
    expect(screen.getByText(/Select a node/i)).toBeTruthy();
  });

  it('renders base properties for the selected node', async () => {
    // Register a stub so the type is treated as supported.
    nodeRegistry.register({
      typeName: FAKE_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
      renderer: () => null as never,
    });

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('SelectedNode', FAKE_TYPE)],
    });

    render(
      <>
        <NodeDetailsPanel />
        <Selector path="SelectedNode" />
      </>,
      { wrapper: panelWrap(graph) }
    );

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    // Title <h3> shows the node name; type row shows the registered type.
    expect(screen.getByRole('heading', { name: 'SelectedNode' })).toBeTruthy();
    expect(screen.getByText(FAKE_TYPE)).toBeTruthy();
  });

  it('renders the "Not Implemented" banner for unregistered types', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Mystery', 'TotallyUnknownType')],
    });

    render(
      <>
        <NodeDetailsPanel />
        <Selector path="Mystery" />
      </>,
      { wrapper: panelWrap(graph) }
    );

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.getByText('Not Implemented')).toBeTruthy();
    expect(screen.getByText(/not yet supported/i)).toBeTruthy();
  });

  it('renders propertyFormatter sections from the registry', async () => {
    nodeRegistry.register({
      typeName: FAKE_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
      renderer: () => null as never,
      propertyFormatter: () => [
        {
          title: 'Stub Section',
          items: [{ label: 'Stub Label', value: 'stub-value' }],
        },
      ],
    });

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('N', FAKE_TYPE)],
    });

    render(
      <>
        <NodeDetailsPanel />
        <Selector path="N" />
      </>,
      { wrapper: panelWrap(graph) }
    );

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.getByText('Stub Section')).toBeTruthy();
    expect(screen.getByText('Stub Label:')).toBeTruthy();
    // Value renders as a plain text node (formatters emit display strings).
    expect(screen.getByText('stub-value')).toBeTruthy();
  });

  it('renders external scene instance row when node.instance is set', async () => {
    nodeRegistry.register({
      typeName: FAKE_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
      renderer: () => null as never,
    });

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Inst', FAKE_TYPE, { instance: 'res://door.tscn' })],
    });

    render(
      <>
        <NodeDetailsPanel />
        <Selector path="Inst" />
      </>,
      { wrapper: panelWrap(graph) }
    );

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.getByText(/External/i)).toBeTruthy();
    expect(screen.getByText('res://door.tscn')).toBeTruthy();
  });
});
