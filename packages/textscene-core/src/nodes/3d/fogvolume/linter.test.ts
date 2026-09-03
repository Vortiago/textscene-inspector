/**
 * Tests for the FogVolume semantic rule — `size` ignored while `shape` is World.
 *
 * Godot does not reject this combination: `set_size` and `set_shape` both take
 * whatever is authored. The warning exists because the collapse to "size does
 * nothing" is otherwise invisible — the .tscn keeps showing the authored size
 * forever, and nothing about loading it fails.
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
} from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

describe('FogVolume size-ignored-for-World rule', () => {
  it('says nothing about a local-shaped FogVolume with a size (happy path)', () => {
    expectClean(scene(node('FogVolume', { shape: 2, size: 'Vector3(4, 3, 4)' }, { name: 'F' })));
  });

  it('leaves the committed fixture clean through the full Linter (validators AND rules)', () => {
    // `linterParser.test.ts`'s `expectFixtureClean` only runs `StrictTscnParser`,
    // which never touches `ruleRegistry` — so it cannot see this rule fire (or
    // fail to). The fixture's "zero warnings" claim spans both halves, and this
    // is the half only `Linter` proves; shape is 2 (Cylinder), not World, so it
    // should stay silent.
    expectClean(readFixture('unit-fog-volume.tscn'));
  });

  it('warns when size is authored alongside shape = World (4)', () => {
    const content = scene(node('FogVolume', { shape: 4, size: 'Vector3(4, 3, 4)' }, { name: 'F' }));
    expectDiagnostic(content, {
      ruleName: 'fogvolume-size-ignored-for-world-shape',
      severity: 'info',
      contains: ['size', 'World'],
    });
  });

  it('never raises an ERROR for the combination — Godot accepts and stores both (severity contract)', () => {
    expectNoErrors(scene(node('FogVolume', { shape: 4, size: 'Vector3(4, 3, 4)' }, { name: 'F' })), {
      ruleName: 'fogvolume-size-ignored-for-world-shape',
    });
  });

  it('stays silent when shape is World but size is not authored (edge case)', () => {
    expectNoDiagnostic(scene(node('FogVolume', { shape: 4 }, { name: 'F' })), {
      ruleName: 'fogvolume-size-ignored-for-world-shape',
    });
  });

  it('stays silent when size is authored but shape is not (edge case)', () => {
    expectNoDiagnostic(scene(node('FogVolume', { size: 'Vector3(4, 3, 4)' }, { name: 'F' })), {
      ruleName: 'fogvolume-size-ignored-for-world-shape',
    });
  });

  it('stays silent when shape is malformed — format errors are the validator’s job, not this rule’s', () => {
    expectNoDiagnostic(
      scene(node('FogVolume', { shape: 'World', size: 'Vector3(4, 3, 4)' }, { name: 'F' })),
      { ruleName: 'fogvolume-size-ignored-for-world-shape' }
    );
  });

  it('leaves other node types alone', () => {
    expectNoDiagnostic(scene(node('Node3D', { shape: 4, size: 'Vector3(4, 3, 4)' }, { name: 'N' })), {
      ruleName: 'fogvolume-size-ignored-for-world-shape',
    });
  });
});
