/**
 * Tests for ShaderGlobalsOverride's semantic rule.
 */

import { describe, it } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('ShaderGlobalsOverride Linter', () => {
  describe('multiple nodes in scene', () => {
    it('warns on every node when more than one is in the scene', () => {
      const content = scene(
        node('Node', {}, { name: 'Root' }),
        node('ShaderGlobalsOverride', {}, { name: 'Override1', parent: '.' }),
        node('ShaderGlobalsOverride', {}, { name: 'Override2', parent: '.' })
      );
      expectDiagnostic(content, {
        ruleName: 'shaderglobalsoverride-multiple-in-scene',
        severity: 'warning',
        nodeType: 'ShaderGlobalsOverride',
        contains: ['Multiple ShaderGlobalsOverride'],
      });
    });

    it('does not warn when only one node is in the scene', () => {
      expectNoDiagnostic(scene(node('ShaderGlobalsOverride', {}, { name: 'Root' })), {
        ruleName: 'shaderglobalsoverride-multiple-in-scene',
      });
    });
  });
});
