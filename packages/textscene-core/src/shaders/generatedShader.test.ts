/** The GLSL three generates for a node graph, read with no GL context. */

import { describe, expect, it } from 'vitest';
import { vec4 } from 'three/tsl';
import { generatedFragmentShader } from './generatedShader.testkit';

describe('generatedFragmentShader', () => {
  it('builds a fragment program that writes the node as its colour', () => {
    const shader = generatedFragmentShader(vec4(1, 0, 0, 1));

    expect(shader).toContain('void main');
    expect(shader).toContain('vec4( 1.0, 0.0, 0.0, 1.0 )');
  });
});
