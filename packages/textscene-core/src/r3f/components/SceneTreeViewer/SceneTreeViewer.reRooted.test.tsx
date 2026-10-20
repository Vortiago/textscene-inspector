/** The scene tree panel lists a node Godot re-roots under its rename, and selects it by that name. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import { fixturesDir } from '../../../parser/testing/parserKit';

function missingParentGraph() {
  const source = readFileSync(join(fixturesDir(), 'edge-missing-parent.tscn'), 'utf8');
  return createSceneGraphFromTscnScene(new TscnParser().parse(source));
}

function withPanel(children: ReactNode) {
  return (
    <HierarchyProvider value={{ sceneGraph: missingParentGraph(), panelId: 'p' }}>
      <SelectionProvider>{children}</SelectionProvider>
    </HierarchyProvider>
  );
}

describe('<SceneTreeViewer> over edge-missing-parent.tscn', () => {
  it('lists each orphan under Root by Godot’s rename', async () => {
    render(withPanel(<SceneTreeViewer />));

    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(screen.getByText('NonExistentParent#Orphan')).toBeTruthy();
    expect(screen.getByText('AlsoMissing#AnotherOrphan')).toBeTruthy();
  });

  it('selects a re-rooted node by its renamed path', async () => {
    let selected: string | null = null;
    function Observer() {
      selected = useSelection().selectedNodePath;
      return null;
    }
    render(
      withPanel(
        <>
          <SceneTreeViewer />
          <Observer />
        </>
      )
    );

    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    await userEvent.click(screen.getByText('AlsoMissing#AnotherOrphan'));

    expect(selected).toBe('Root/AlsoMissing#AnotherOrphan');
  });
});
