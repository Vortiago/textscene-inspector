/**
 * Tests for VoxelGI's semantic linter rule (voxel_gi.cpp:548's missing-data check).
 */

import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

const RULE_NAME = 'voxelgi-missing-data';

describe('VoxelGI semantic rules', () => {
  it('warns when data is absent', () => {
    expectDiagnostic(scene(node('VoxelGI', { size: 'Vector3(10, 10, 10)' })), {
      ruleName: RULE_NAME,
      severity: 'warning',
    });
  });

  it('does not warn when data is set', () => {
    expectNoDiagnostic(
      scene(
        node('VoxelGI', { size: 'Vector3(10, 10, 10)', data: 'SubResource("1")' }),
        '[sub_resource type="VoxelGIData" id="1"]'
      ),
      { ruleName: RULE_NAME }
    );
  });

  it('does not fire on the committed VoxelGI fixture, which already sets data', () => {
    const found = new Linter()
      .lint(readFixture('unit-voxel-gi.tscn'))
      .filter((d) => d.ruleName === RULE_NAME);
    expect(found).toEqual([]);
  });
});
