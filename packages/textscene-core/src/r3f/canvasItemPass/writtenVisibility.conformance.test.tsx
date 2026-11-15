/**
 * Every container that writes its pages' `visible` hides the same pages for the canvas item pass and
 * for the Control walk. The list comes from the source, so a new container cannot join without a
 * scene here.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook } from '@testing-library/react';
import { TscnParser } from '../../parser/TscnParser';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { useBuildSolveTree } from '../controls/native/buildSolveTree';
import { canvasItemPass } from './canvasItemPass';
import '../nodes/index';
import '../controls/index';

const NODES_DIR = join(import.meta.dirname, '../../nodes');

/** The types whose node registration declares `writesChildVisibility`. */
function typesThatWriteVisibility(): string[] {
  const files = readdirSync(NODES_DIR, { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.ts') && !file.includes('.test.')
  );
  return files.flatMap((file) => {
    const source = readFileSync(join(NODES_DIR, file), 'utf8');
    if (!source.includes('writesChildVisibility:')) return [];
    return [...source.matchAll(/typeName: '(\w+)'/g)].map((match) => match[1]!);
  });
}

/** The lines that make each container hide at least one of two pages. */
const HIDING_LINES: Readonly<Record<string, string>> = {
  TabContainer: 'current_tab = 1',
  FoldableContainer: 'folded = true',
};

function containerScene(type: string): string {
  return `[gd_scene format=3]

[node name="Box" type="${type}"]
offset_right = 200.0
offset_bottom = 200.0
${HIDING_LINES[type]}

[node name="First" type="Control" parent="."]

[node name="InFirst" type="Node2D" parent="First"]

[node name="Second" type="Control" parent="."]

[node name="InSecond" type="Node2D" parent="Second"]
`;
}

describe('the visible a container writes', () => {
  const types = typesThatWriteVisibility();

  it('has a scene for every container that writes it', () => {
    expect(types.length).toBeGreaterThan(0);
    expect(types.filter((type) => !(type in HIDING_LINES))).toEqual([]);
  });

  it.each(types)('hides the same pages of a %s for the pass and the walk', (type) => {
    const scene = new TscnParser().parse(containerScene(type));
    const results = canvasItemPass(liveTreeOf(scene.nodes, contextOver(scene, {})));
    const { result } = renderHook(() => useBuildSolveTree(scene.nodes, [], []));
    const pages = result.current.tree[0]!.children;

    const walked = pages.map((page) => (page.node.properties as { visible?: boolean }).visible !== false);
    const passed = ['Box/First/InFirst', 'Box/Second/InSecond'].map(
      (path) => results.get(path)!.parentVisibleInTree
    );
    expect(walked).toContain(false);
    expect(passed).toEqual(walked);
  });
});
