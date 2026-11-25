import { describe, expect, it } from 'vitest';
import { headingReads } from './headingReads.js';
import { parseHeading } from './utils.js';

function readsOf(...headings: string[]) {
  const collector = headingReads();
  headings.forEach((heading, index) => collector.read(parseHeading(heading)!, index + 1));
  return collector.reads;
}

describe('headingReads', () => {
  it('collects the binds of each connection heading as written', () => {
    expect(
      readsOf('[connection signal="ready" from="." to="." method="go" binds=[ExtResource("1")]]')
        .connections[0]?.binds
    ).toBe('[ExtResource("1")]');
  });

  it('collects the line and the four required fields of a connection heading', () => {
    const [connection] = readsOf(
      '[node name="Root" type="Node"]',
      '[connection signal="ready" from="Button" method="go"]'
    ).connections;
    expect(connection).toMatchObject({
      line: 2,
      signal: 'ready',
      from: 'Button',
      to: undefined,
      method: 'go',
    });
  });

  it('reads the id trail of each uid path a connection heading carries', () => {
    const [connection] = readsOf(
      '[connection signal="ready" from="." to="." method="go" to_uid_path=PackedInt32Array(1, 2)]'
    ).connections;
    expect(connection).toMatchObject({ fromIdTrail: undefined, toIdTrail: [1, 2] });
  });

  it('answers the type of the heading before each heading', () => {
    const collector = headingReads();
    const headings = ['[gd_scene format=3]', '[node name="Root" type="Node3D"]', '[editable path="Root"]'];
    expect(headings.map((heading, index) => collector.read(parseHeading(heading)!, index + 1))).toEqual([
      null,
      'gd_scene',
      'node',
    ]);
  });

  it('collects the line of each editable heading that has no path', () => {
    const reads = readsOf(
      '[node name="Root" type="Node3D"]',
      '[editable]',
      '[editable path="Inner"]',
      '[editable]'
    );
    expect(reads.pathlessEditableLines).toEqual([2, 4]);
  });

  it('leaves binds undefined on a connection without binds', () => {
    expect(readsOf('[connection signal="ready" from="." to="." method="go"]').connections[0]?.binds).toBe(
      undefined
    );
  });
});
