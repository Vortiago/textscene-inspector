/** The scene provider stack: which providers mount, in which order, with which props. */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { TscnScene } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasWorkspaceProvider, useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { SceneStack } from './SceneStack';

const SCENE: Pick<TscnScene, 'internalResources' | 'externalResources'> = {
  internalResources: [{ id: 'Gradient_1', type: 'Gradient', data: {} }],
  externalResources: [{ id: '1', type: 'Texture2D', path: 'res://icon.png' }],
};

type Props = Record<string, unknown> & { children?: ReactNode };

/** The provider elements from `element` inward, each with its props minus `children`. */
function providerChain(element: ReactElement): Array<{ type: unknown; props: Props }> {
  const chain: Array<{ type: unknown; props: Props }> = [];
  let node: ReactNode = element;
  while (isValidElement(node)) {
    const { children, ...props } = node.props as Props;
    chain.push({ type: node.type, props });
    if (node.type === SelectionProvider) break;
    node = children;
  }
  return chain;
}

/** The children the stack hands to SelectionProvider, with React's empty `false` slot removed. */
function selectionChildren(element: ReactElement): ReactNode[] {
  let node: ReactNode = element;
  while (isValidElement(node) && node.type !== SelectionProvider) {
    node = (node.props as Props).children;
  }
  const children = isValidElement(node) ? (node.props as Props).children : undefined;
  return (Array.isArray(children) ? children : [children]).filter((child) => child !== false);
}

function WorkspaceProbe() {
  return <span data-testid="workspace">{useCanvasWorkspace()}</span>;
}

function SelectionProbe() {
  return <span data-testid="selected">{useSelection().selectedNodePath ?? 'none'}</span>;
}

describe('SceneStack', () => {
  const loader = createFakeResourceLoader().loader;

  it('mounts the workspace, loader, scene resources and selection, outermost first', () => {
    const element = SceneStack({ scene: SCENE, loader, workspace: '2d', children: null });
    expect(providerChain(element)).toEqual([
      { type: CanvasWorkspaceProvider, props: { workspace: '2d' } },
      { type: ResourceLoaderProvider, props: { loader } },
      {
        type: SceneResourcesProvider,
        props: {
          internalResources: SCENE.internalResources,
          externalResources: SCENE.externalResources,
        },
      },
      { type: SelectionProvider, props: {} },
    ]);
  });

  it('mounts no workspace provider when none is given', () => {
    const element = SceneStack({ scene: SCENE, loader, children: null });
    expect(providerChain(element).map(({ type }) => type)).toEqual([
      ResourceLoaderProvider,
      SceneResourcesProvider,
      SelectionProvider,
    ]);
  });

  it('hands an array the scene omits to the scene resources provider as undefined', () => {
    const scene = { externalResources: SCENE.externalResources };
    const element = SceneStack({ scene, loader, children: null });
    const resources = providerChain(element).find(({ type }) => type === SceneResourcesProvider);
    expect(resources?.props).toEqual({
      internalResources: undefined,
      externalResources: SCENE.externalResources,
    });
  });

  it('leaves the context default in force without a workspace', () => {
    const { getByTestId } = render(
      <SceneStack scene={SCENE} loader={loader}>
        <WorkspaceProbe />
      </SceneStack>
    );
    expect(getByTestId('workspace').textContent).toBe('3d');
  });

  it('provides the workspace it is given', () => {
    const { getByTestId } = render(
      <SceneStack scene={SCENE} loader={loader} workspace="2d">
        <WorkspaceProbe />
      </SceneStack>
    );
    expect(getByTestId('workspace').textContent).toBe('2d');
  });

  it('selects the given path once mounted', () => {
    const { getByTestId } = render(
      <SceneStack scene={SCENE} loader={loader} selectedPath="Root/Sprite">
        <SelectionProbe />
      </SceneStack>
    );
    expect(getByTestId('selected').textContent).toBe('Root/Sprite');
  });

  it('mounts no seeder without a path, so the children are all the selection holds', () => {
    const probe = <SelectionProbe />;
    const element = SceneStack({ scene: SCENE, loader, children: probe });
    expect(selectionChildren(element)).toEqual([probe]);
  });
});
