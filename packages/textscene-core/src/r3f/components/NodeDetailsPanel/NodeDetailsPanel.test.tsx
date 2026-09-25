import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { CameraControlProvider } from '../../contexts/CameraControlContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { nodeRegistry } from '../../../core/NodeRegistry';
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
  // Remove the registrations the tests added, so none leaks.
  nodeRegistry.unregister(FAKE_TYPE);
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
      parser: () => ({}),
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

    // The title shows the node name. The type row shows the registered type.
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
    expect(screen.getByText(/not yet drawn/i)).toBeTruthy();
    // The banner sits above the details, not in their place: an unrendered node
    // still has parsed, validated properties to inspect.
    expect(screen.getByRole('heading', { name: 'Mystery' })).toBeTruthy();
    expect(screen.getByText('TotallyUnknownType')).toBeTruthy();
    expect(screen.getByText('Path:')).toBeTruthy();
  });

  it('renders propertyFormatter sections from the registry', async () => {
    nodeRegistry.register({
      typeName: FAKE_TYPE,
      parser: () => ({}),
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
    // Formatters emit display strings, so the value is a plain text node.
    expect(screen.getByText('stub-value')).toBeTruthy();
  });

  it('renders external scene instance row when node.instance is set', async () => {
    nodeRegistry.register({
      typeName: FAKE_TYPE,
      parser: () => ({}),
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

describe('<NodeDetailsPanel> camera actions', () => {
  function cameraWrap(graph: ReturnType<typeof createSceneGraphFromTscnScene>) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
          <SelectionProvider>
            <CameraControlProvider>{children}</CameraControlProvider>
          </SelectionProvider>
        </HierarchyProvider>
      );
    };
  }

  async function selectAndRender(type: string) {
    const graph = createSceneGraphFromTscnScene({ nodes: [makeNode('Eye', type)] });
    render(
      <>
        <NodeDetailsPanel />
        <Selector path="Eye" />
      </>,
      { wrapper: cameraWrap(graph) }
    );
    await act(async () => {
      screen.getByTestId('select-node').click();
    });
  }

  it('offers "Use This Camera" for a Camera3D', async () => {
    await selectAndRender('Camera3D');
    expect(screen.getByRole('button', { name: 'Use This Camera' })).toBeTruthy();
  });

  // The action follows Godot's class tree, not the literal type name: the
  // renderer mounts the Camera3D component for an XRCamera3D, so the inspector
  // must let the user look through it.
  it('offers "Use This Camera" for a Camera3D subclass (XRCamera3D)', async () => {
    await selectAndRender('XRCamera3D');
    expect(screen.getByRole('button', { name: 'Use This Camera' })).toBeTruthy();
  });

  it('offers no camera action for a non-camera node', async () => {
    await selectAndRender('Node3D');
    expect(screen.queryByRole('button', { name: 'Use This Camera' })).toBeNull();
  });
});
