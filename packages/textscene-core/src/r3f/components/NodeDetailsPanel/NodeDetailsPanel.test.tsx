import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { TestPreviewCamera } from '../TscnPreviewShell/previewCamera.testkit';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { nodeRegistry } from '../../../core/NodeRegistry';
import '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';
import { PreviewViewStatusProvider } from '../TscnPreviewShell/previewViewStatus';
import type { UndrawnNode } from '../../viewStatus/undrawnNodes';
import { createExternalStore } from '../../../utils/externalStore';

/** A node with the properties its parser reads of an empty section, as the scene's parse gives them. */
function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  const properties = nodeRegistry
    .getRegistration(type)
    ?.parser({ type: 'node', attributes: { name, type } }, {});
  return { rawProperties: {}, name, type, children: [], properties: properties ?? {}, ...extras };
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

/** The shell's view reporting `undrawn` and nothing else. */
function ViewReporting({ undrawn, children }: { undrawn: UndrawnNode[]; children: ReactNode }) {
  const status = {
    settled: null,
    pending: { textures: 0, fonts: 0 },
    frame: null,
    undrawn,
    isSoftwareRendering: false,
    freelook: null,
  };
  const heard = createExternalStore({ status, round: 0 });
  return <PreviewViewStatusProvider value={heard}>{children}</PreviewViewStatusProvider>;
}

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

  it('names a mesh type the previewer does not draw', async () => {
    nodeRegistry.register({ typeName: FAKE_TYPE, parser: () => ({}) });
    const graph = createSceneGraphFromTscnScene({ nodes: [makeNode('Sign', FAKE_TYPE)] });

    render(
      <ViewReporting
        undrawn={[
          { path: '/root/Sign', meshTypes: ['FutureMesh'], isEmptyShape: false, hasNoComponent: false },
        ]}
      >
        <NodeDetailsPanel />
        <Selector path="Sign" />
      </ViewReporting>,
      { wrapper: panelWrap(graph) }
    );
    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.getByText(/Its FutureMesh mesh is not yet drawn/)).toBeTruthy();
  });

  it("shows Godot's empty-shape warning for a shape with an empty brush", async () => {
    nodeRegistry.register({ typeName: FAKE_TYPE, parser: () => ({}) });
    const graph = createSceneGraphFromTscnScene({ nodes: [makeNode('Wall', FAKE_TYPE)] });

    render(
      <ViewReporting
        undrawn={[{ path: '/root/Wall', meshTypes: [], isEmptyShape: true, hasNoComponent: false }]}
      >
        <NodeDetailsPanel />
        <Selector path="Wall" />
      </ViewReporting>,
      { wrapper: panelWrap(graph) }
    );
    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.getByText('The CSGShape3D has an empty shape.')).toBeTruthy();
    expect(screen.getByText('Each edge must be a member of exactly two faces.')).toBeTruthy();
  });

  it('shows no empty-shape warning for a shape that holds a solid', async () => {
    nodeRegistry.register({ typeName: FAKE_TYPE, parser: () => ({}) });
    const graph = createSceneGraphFromTscnScene({ nodes: [makeNode('Wall', FAKE_TYPE)] });

    render(
      <ViewReporting
        undrawn={[
          { path: '/root/Wall', meshTypes: ['FutureMesh'], isEmptyShape: false, hasNoComponent: false },
        ]}
      >
        <NodeDetailsPanel />
        <Selector path="Wall" />
      </ViewReporting>,
      { wrapper: panelWrap(graph) }
    );
    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.queryByText('The CSGShape3D has an empty shape.')).toBeNull();
  });

  it('renders the sections of the formatter of the selected class', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('N', 'Timer', { properties: { wait_time: 2.5 } })],
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

    expect(screen.getByText('Wait Time (s):')).toBeTruthy();
    // Formatters emit display strings, so the value is a plain text node.
    expect(screen.getByText('2.50')).toBeTruthy();
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
            <TestPreviewCamera>{children}</TestPreviewCamera>
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

  it("offers Godot's Preview checkbox, unchecked, for a Camera3D", async () => {
    await selectAndRender('Camera3D');
    expect((screen.getByRole('checkbox', { name: 'Preview' }) as HTMLInputElement).checked).toBe(false);
  });

  it('checks Preview while the viewport previews the camera, and clears it when unchecked', async () => {
    await selectAndRender('Camera3D');
    const preview = screen.getByRole('checkbox', { name: 'Preview' }) as HTMLInputElement;

    await act(async () => preview.click());
    expect(preview.checked).toBe(true);

    await act(async () => preview.click());
    expect(preview.checked).toBe(false);
  });

  // The checkbox follows Godot's class tree, not the literal type name: the
  // renderer mounts the Camera3D component for an XRCamera3D, so the inspector
  // must let the user look through it.
  it('offers Preview for a Camera3D subclass (XRCamera3D)', async () => {
    await selectAndRender('XRCamera3D');
    expect(screen.getByRole('checkbox', { name: 'Preview' })).toBeTruthy();
  });

  it('offers no Preview for a non-camera node', async () => {
    await selectAndRender('Node3D');
    expect(screen.queryByRole('checkbox', { name: 'Preview' })).toBeNull();
  });

  describe('copy node path', () => {
    const SCENE = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Root', 'Node3D', {
          children: [makeNode('Player', 'Node3D', { children: [makeNode('Camera3D', 'Camera3D')] })],
        }),
      ],
    });

    async function copyFor(selected: string): Promise<ReturnType<typeof vi.fn>> {
      const onCopyNodePath = vi.fn();
      render(
        <>
          <NodeDetailsPanel onCopyNodePath={onCopyNodePath} />
          <Selector path={selected} />
        </>,
        { wrapper: panelWrap(SCENE) }
      );
      await act(async () => {
        screen.getByTestId('select-node').click();
      });
      await act(async () => {
        screen.getByRole('button', { name: 'Copy node path' }).click();
      });
      return onCopyNodePath;
    }

    it.each([
      ['the root as "."', 'Root', '.'],
      ['a nested node from the root, without the root name', 'Root/Player/Camera3D', 'Player/Camera3D'],
    ])('asks the host to copy %s', async (_what, selected, expected) => {
      expect(await copyFor(selected)).toHaveBeenCalledExactlyOnceWith(expected);
    });

    it('leaves the displayed Path row as the live path', async () => {
      await copyFor('Root/Player');
      expect(screen.getByText('Root/Player')).toBeTruthy();
    });

    it('has no copy button when the host cannot copy', async () => {
      render(
        <>
          <NodeDetailsPanel />
          <Selector path="Root" />
        </>,
        { wrapper: panelWrap(SCENE) }
      );
      await act(async () => {
        screen.getByTestId('select-node').click();
      });
      expect(screen.queryByRole('button', { name: 'Copy node path' })).toBeNull();
    });
  });
});
