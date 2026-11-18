import { describe, expect, it } from 'vitest';
import type { TemplateStageNode } from './templateTree.js';
import { TreeMemo, type TreeKey } from './treeMemo.js';

const KEY: TreeKey = {
  source: 'shader_type sky;\n',
  file: 'user.gdshader',
  shaderType: 'sky',
  template: 'environment/sky.glsl',
  stage: 'fragment',
  defines: '',
  godotVersion: '4.6.3',
  transpilerVersion: 1,
};

/** A memo and a count of the trees its builder has built. */
function countingMemo() {
  const memo = new TreeMemo();
  let builds = 0;
  const tree = (key: TreeKey) =>
    memo.tree(key, () => {
      builds += 1;
      return { kind: 'template stage' } as unknown as TemplateStageNode;
    });
  return { tree, builds: () => builds };
}

describe('TreeMemo', () => {
  it('builds the tree of one key once', () => {
    const { tree, builds } = countingMemo();
    tree(KEY);
    tree({ ...KEY });
    expect(builds()).toBe(1);
  });

  it.each([
    ['source', { source: 'shader_type sky;\n// changed\n' }],
    ['file', { file: 'other.gdshader' }],
    ['shaderType', { shaderType: 'spatial' }],
    ['template', { template: 'environment/other.glsl' }],
    ['stage', { stage: 'vertex' }],
    ['defines', { defines: '#define USE_QUARTER_RES_PASS\n' }],
    ['godotVersion', { godotVersion: '4.7.2' }],
    ['transpilerVersion', { transpilerVersion: 2 }],
  ] as const)('builds a new tree when the %s changes', (_, change) => {
    const { tree, builds } = countingMemo();
    tree(KEY);
    tree({ ...KEY, ...change });
    expect(builds()).toBe(2);
  });

  it('drops the least recently read tree past the trees it keeps', () => {
    const { tree, builds } = countingMemo();
    tree(KEY);
    for (let index = 0; index < 64; index += 1) tree({ ...KEY, source: `// ${index}` });
    tree(KEY);
    expect(builds()).toBe(66);
  });

  it('keeps a tree that was read again', () => {
    const { tree, builds } = countingMemo();
    tree(KEY);
    for (let index = 0; index < 64; index += 1) {
      tree({ ...KEY, source: `// ${index}` });
      tree(KEY);
    }
    expect(builds()).toBe(65);
  });
});
