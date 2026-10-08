import { describe, expect, it } from 'vitest';
import { headingResourceReads } from './headingResourceReads.js';
import { parseHeading } from '../parser/utils.js';

function readsOf(...headings: string[]) {
  const collector = headingResourceReads();
  for (const line of headings) collector.read(parseHeading(line)!);
  return collector.reads;
}

describe('headingResourceReads', () => {
  it('collects the binds of each connection heading as written', () => {
    expect(
      readsOf('[connection signal="ready" from="." to="." method="go" binds=[ExtResource("1")]]')
        .connectionBinds
    ).toEqual(['[ExtResource("1")]']);
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

  it('collects nothing from a connection without binds', () => {
    expect(readsOf('[connection signal="ready" from="." to="." method="go"]')).toEqual({
      connectionBinds: [],
      instancesOutsideNodeBody: [],
    });
  });
});
