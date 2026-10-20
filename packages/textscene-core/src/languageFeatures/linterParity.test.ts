/** The language features and the linter name the same `[node]` heading for every connection end. */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../linter/StrictTscnParser';
import { LanguageDocument } from './document';
import { nodeSectionOfPath } from './nodeSeating';
import { INSTANCED_TREE, NODE_TREE_HEAD } from './fixtures.testkit';

const SCENES = {
  'nested nodes': [
    ...NODE_TREE_HEAD,
    '[connection signal="a" from="Player/Sprite" to="." method="_a"]',
    '[connection signal="b" from="./Player" to="Player/../Player/Sprite/Gun" method="_b"]',
    '[connection signal="c" from="Missing" to=".." method="_c"]',
  ].join('\n'),
  'nodes under an instanced scene': INSTANCED_TREE.replace(
    '[connection',
    '[connection signal="b" from="Inst/Sub" to="Inst/Sub/X/Y" method="_b"]\n[connection'
  ),
};

/** Each connection end's path, with the one-based heading line each side resolves it to. */
function headingLinesOfEnds(text: string): { path: string; linter?: number; languageFeatures?: number }[] {
  const { scene, lines } = new StrictTscnParser().parse(text);
  const document = new LanguageDocument(text);
  return scene!.connections.flatMap(({ from, to }) =>
    [from!, to!].map((path) => {
      const resolution = scene!.resolveRootPath(path);
      return {
        path,
        linter: resolution.status === 'found' ? lines.get(resolution.node)?.heading : undefined,
        languageFeatures: nodeSectionOfPath(document, path)?.headingLine,
      };
    })
  );
}

describe('a connection end in the linter and the language features', () => {
  it.each(Object.entries(SCENES))('resolves to the same heading in a scene of %s', (_name, text) => {
    for (const end of headingLinesOfEnds(text)) expect(end.languageFeatures, end.path).toBe(end.linter);
  });

  it('resolves the ends of a scene under an instance to headings', () => {
    const resolved = headingLinesOfEnds(SCENES['nodes under an instanced scene']).filter(
      ({ linter }) => linter
    );
    expect(resolved.map(({ path }) => path)).toEqual(['Inst/Sub/X/Y', '.', 'Inst/Sub/X']);
  });
});
