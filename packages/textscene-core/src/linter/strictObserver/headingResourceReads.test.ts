import { describe, expect, it } from 'vitest';
import { headingResourceReads } from './headingResourceReads.js';
import { parseHeading } from '../../parser/utils.js';

function readsOf(...headings: string[]) {
  const collector = headingResourceReads();
  headings.forEach((heading, index) => collector.read(parseHeading(heading)!, index + 1));
  return collector.reads;
}

describe('headingResourceReads', () => {
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

  it('collects an instance on a node heading that follows no other node', () => {
    const reads = readsOf(
      '[node name="Root" type="Node3D"]',
      '[node name="Inner" parent="." instance=ExtResource("1")]',
      '[editable path="Inner"]',
      '[node name="After" parent="." instance=ExtResource("2")]'
    );
    expect(reads.instancesOutsideNodeBody).toEqual(['ExtResource("2")']);
  });

  it('collects the first heading of the file when it instances a scene', () => {
    expect(readsOf('[node name="Root" instance=ExtResource("1")]').instancesOutsideNodeBody).toEqual([
      'ExtResource("1")',
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
