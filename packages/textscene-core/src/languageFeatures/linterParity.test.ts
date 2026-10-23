/** The language features and the linter name the same `[node]` heading for every connection end. */

import { describe, expect, it } from 'vitest';
import { connectionDiagnostics } from '../linter/connectionDiagnostics';
import { StrictTscnParser } from '../linter/StrictTscnParser';
import { LanguageDocument } from './document';
import { nodeSectionOfConnectionEnd } from './nodeSeating';
import { INSTANCED_TREE, NODE_TREE_HEAD } from './fixtures.testkit';

const SCENES = {
  'nested nodes': [
    ...NODE_TREE_HEAD,
    '[connection signal="a" from="Player/Sprite" to="." method="_a"]',
    '[connection signal="b" from="./Player" to="Player/../Player/Sprite/Gun" method="_b"]',
    '[connection signal="c" from="Missing" to=".." method="_c"]',
  ].join('\n'),
  'a connection end that only its uid path recovers': [
    '[gd_scene format=3]',
    '',
    '[node name="Root" type="Node3D" unique_id=1]',
    '',
    '[node name="Button" type="Node3D" parent="." unique_id=7]',
    '',
    '[connection signal="a" from="Gone" to="Gone" method="_a" from_uid_path=PackedInt32Array(7)]',
  ].join('\n'),
  'nodes under an instanced scene': INSTANCED_TREE.replace(
    '[connection',
    '[connection signal="b" from="Inst/Sub" to="Inst/Sub/X/Y" method="_b"]\n[connection'
  ),
};

interface EndHeadings {
  path: string;
  linter?: number;
  languageFeatures?: number;
}

/** Each connection end's path, with the one-based heading line each side resolves it to. */
function headingLinesOfEnds(text: string): EndHeadings[] {
  const { scene, lines } = new StrictTscnParser().parse(text);
  const document = new LanguageDocument(text);
  const ends = scene!.connections.flatMap(({ from, to, fromIdTrail, toIdTrail }) => [
    { path: from!, idTrail: fromIdTrail },
    { path: to!, idTrail: toIdTrail },
  ]);
  return ends.map(({ path, idTrail }) => {
    const resolution = scene!.resolveConnectionEnd(path, idTrail);
    return {
      path,
      linter: resolution.status === 'found' ? lines.get(resolution.node)?.heading : undefined,
      languageFeatures: nodeSectionOfConnectionEnd(document, path, idTrail)?.headingLine,
    };
  });
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

  it('resolves an end that only its uid path recovers, which the linter does not report', () => {
    const text = SCENES['a connection end that only its uid path recovers'];
    const { scene } = new StrictTscnParser().parse(text);
    expect(connectionDiagnostics(scene!)).toEqual([
      expect.objectContaining({ message: expect.stringContaining('to="Gone"') }),
    ]);
    expect(headingLinesOfEnds(text).map(({ languageFeatures }) => languageFeatures)).toEqual([5, undefined]);
  });
});
