/** The scene tree panel lists a node Godot re-roots under its rename, and selects it by that name. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelectedNodePath } from '../../contexts/SelectionContext';
import { fixturesDir } from '../../../parser/testing/parserKit';
import { expandAllRows, renderSceneTree } from './sceneTree.testkit';

const MISSING_PARENT = readFileSync(join(fixturesDir(), 'edge-missing-parent.tscn'), 'utf8');

describe('<SceneTreeViewer> over edge-missing-parent.tscn', () => {
  it('lists each orphan under Root by Godot’s rename', async () => {
    const { scene } = await renderSceneTree(MISSING_PARENT);
    await expandAllRows(scene);

    expect(screen.getByText('NonExistentParent#Orphan')).toBeTruthy();
    expect(screen.getByText('AlsoMissing#AnotherOrphan')).toBeTruthy();
  });

  it('selects a re-rooted node by its renamed path', async () => {
    let selected: string | null = null;
    function Observer() {
      selected = useSelectedNodePath();
      return null;
    }
    const { scene } = await renderSceneTree(MISSING_PARENT, { beside: <Observer /> });
    await expandAllRows(scene);

    await userEvent.click(screen.getByText('AlsoMissing#AnotherOrphan'));

    expect(selected).toBe('Root/AlsoMissing#AnotherOrphan');
  });
});
