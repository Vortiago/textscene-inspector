import { describe, expect, it } from 'vitest';
import { instancedPaths } from './instancedPaths.js';
import { parseHeading } from '../../parser/utils.js';

/** A tracker fed these `[node]` headings in order, the first as the root. */
function trackerOf(...headings: string[]) {
  const tracker = instancedPaths();
  headings.forEach((line, i) => tracker.record(parseHeading(line)!, i === 0));
  return tracker;
}

describe('instancedPaths', () => {
  it('vouches for every path below a node that instances a scene', () => {
    const tracker = trackerOf(
      '[node name="Root" type="Node3D"]',
      '[node name="Rock" parent="." instance=ExtResource("1")]'
    );
    expect(tracker.hasInstancedAncestor('Rock')).toBe(true);
    expect(tracker.hasInstancedAncestor('./Rock/Mesh')).toBe(true);
  });

  it('vouches for every path when the root instances a scene', () => {
    expect(
      trackerOf('[node name="Root" instance=ExtResource("1")]').hasInstancedAncestor('Anything/Below')
    ).toBe(true);
  });

  it('vouches for nothing outside an instance', () => {
    const tracker = trackerOf(
      '[node name="Root" type="Node3D"]',
      '[node name="Rock" parent="." instance=ExtResource("1")]'
    );
    expect(tracker.hasInstancedAncestor('Other')).toBe(false);
    expect(tracker.hasInstancedAncestor('.')).toBe(false);
  });

  it('vouches for nothing below an InstancePlaceholder, which has no children', () => {
    const tracker = trackerOf(
      '[node name="Root" type="Node3D"]',
      '[node name="Rock" parent="." instance_placeholder="res://rock.tscn"]'
    );
    expect(tracker.hasInstancedAncestor('Rock')).toBe(false);
  });

  it('vouches for nothing from an instance under a path that names nothing', () => {
    const tracker = trackerOf(
      '[node name="Root" type="Node3D"]',
      '[node name="Rock" parent="/abs" instance=ExtResource("1")]'
    );
    expect(tracker.hasInstancedAncestor('Rock')).toBe(false);
  });
});
