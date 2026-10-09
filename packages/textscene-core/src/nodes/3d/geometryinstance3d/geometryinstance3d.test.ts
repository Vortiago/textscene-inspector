/**
 * GeometryInstance3D registration: it is parsed, and it draws nothing on purpose
 * (ADR-0008).
 */

import { describe, expect, it } from 'vitest';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../parser/TscnParser';
import './index';
import './index.r3f';

describe('GeometryInstance3D registration', () => {
  it('parses its own transparency', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="G" type="GeometryInstance3D"]\ntransparency = 0.25\n'
    );
    expect(scene.nodes[0]!.properties).toMatchObject({ transparency: 0.25 });
  });

  it('registers the undrawn component, which holds its place in the scene cull', () => {
    expect(nodeComponentRegistry.get('GeometryInstance3D')?.displayName).toBe(
      'withGeometryInstance(UndrawnGeometryInstance)'
    );
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('GeometryInstance3D')).toBe(true);
  });
});
