import { describe, expect, it } from 'vitest';
import { strictObserver } from './strictObserver.js';
import { TscnParserCore } from '../../parser/TscnParserCore.js';
import '../index.js';

/** Scans `content` with the observer and no nodes built, and returns what it collected. */
function observe(content: string) {
  const collected = strictObserver();
  new TscnParserCore().parse(content, () => null, collected.observer);
  return collected;
}

describe('strictObserver', () => {
  it('collects nothing from a well-formed scene', () => {
    expect(
      observe('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\nvisible = true\n').errors
    ).toEqual([]);
  });

  it('stamps a property refusal with its section owner', () => {
    const [error] = observe(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\nvisible = "yes"\n'
    ).errors;
    expect(error).toMatchObject({ line: 4, nodeName: 'Root', nodeType: 'Node3D' });
  });

  it('gives a malformed heading no owner from the section before it', () => {
    const { errors } = observe(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n[node name="Bad"\n'
    );
    expect(errors).toEqual([expect.objectContaining({ code: 'INVALID_HEADING_FORMAT' })]);
    expect(errors[0]).not.toHaveProperty('nodeName');
  });

  it('collects the heading reads', () => {
    const { headingReads } = observe(
      '[gd_scene format=3]\n\n[node name="Root" instance=ExtResource("1")]\n\n' +
        '[connection signal="ready" from="." to="." method="go" binds=[1]]\n'
    );
    expect(headingReads).toEqual({
      connectionBinds: ['[1]'],
      instancesOutsideNodeBody: ['ExtResource("1")'],
    });
  });
});
