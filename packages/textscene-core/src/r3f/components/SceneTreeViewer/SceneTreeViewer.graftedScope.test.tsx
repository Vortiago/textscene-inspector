/**
 * An outliner row for a node grafted into an instanced sub-scene resolves its instance ref in
 * the host file that authored it, not in the sub-scene whose group it sits in.
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  recordSceneRequests,
} from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import {
  HOST_LEAF_PATH,
  SUB_LEAF_PATH,
  SUB_PATH,
  hostScene,
  subScene,
} from '../../testing/graftedScopeFixture';

describe('<SceneTreeViewer> — a node grafted into an instanced sub-scene', () => {
  it('requests the scene its host file names for the grafted instance', () => {
    const fake = createFakeResourceLoader();
    const requested = recordSceneRequests(fake);
    fake.scenes.seed(SUB_PATH, subScene);
    const sceneGraph = createSceneGraphFromTscnScene(hostScene);

    render(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <SelectionProvider>
          <ResourceLoaderProvider loader={fake.loader}>
            <MissingResourcesProvider>
              <SceneTreeViewer />
            </MissingResourcesProvider>
          </ResourceLoaderProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );

    // Each click renders the next level, so the Leaf row mounts last.
    for (let depth = 0; depth < 3; depth++) {
      act(() => fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0]!));
    }

    expect([...requested.keys()]).toEqual([HOST_LEAF_PATH]);
    expect(requested.has(SUB_LEAF_PATH)).toBe(false);
  });
});
