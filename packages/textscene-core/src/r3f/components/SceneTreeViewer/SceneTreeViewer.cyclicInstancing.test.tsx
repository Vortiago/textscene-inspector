/**
 * Cyclic instancing in the outliner: a row that instances a scene already above it
 * shows no content, so "Expand all" and search end.
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';

/** `res://a.tscn`: a root with two children that each instance `res://a.tscn`, both editable. */
const SELF_SCENE = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://a.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="A" parent="." instance=ExtResource("1")]

[node name="B" parent="." instance=ExtResource("1")]

[editable path="A"]

[editable path="B"]
`);

function renderSelfInstancing() {
  const fake = createFakeResourceLoader();
  fake.scenes.seed('res://a.tscn', SELF_SCENE);
  const sceneGraph = createSceneGraphFromTscnScene(SELF_SCENE);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <SelectionProvider>
        <ResourceLoaderProvider loader={fake.loader}>
          <MissingResourcesProvider>{children}</MissingResourcesProvider>
        </ResourceLoaderProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
  render(<SceneTreeViewer />, { wrapper });
}

function rowPaths(): string[] {
  return Array.from(document.querySelectorAll('[data-node-path]')).map((row) =>
    row.getAttribute('data-node-path')!
  );
}

function row(path: string): HTMLElement {
  return document.querySelector(`[data-node-path="${path}"]`)!;
}

describe('<SceneTreeViewer> cyclic instancing', () => {
  it('expands every row once, ending at the instances inside their own scene', () => {
    renderSelfInstancing();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Expand all' })));

    expect(rowPaths()).toEqual(['Root', 'Root/A', 'Root/A/A', 'Root/A/B', 'Root/B', 'Root/B/A', 'Root/B/B']);
  });

  it('shows the stopped instance as a leaf row, with no chevron', () => {
    renderSelfInstancing();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Expand all' })));

    const header = row('Root/A/B').querySelector('[role="treeitem"]')!;
    expect(header.getAttribute('aria-expanded')).toBeNull();
    expect(header.textContent).toContain('•');
  });

  it('ends a search that matches every repeated row', () => {
    renderSelfInstancing();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Expand all' })));
    act(() => fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'b' } }));

    expect(rowPaths()).toEqual(['Root', 'Root/A', 'Root/A/B', 'Root/B', 'Root/B/B']);
  });
});
