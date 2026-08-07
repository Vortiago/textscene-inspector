/**
 * Container linter tests — `Container::get_configuration_warnings()`
 * (container.cpp:207-214): exact-class `Container` with no script attached.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('Container Linter (container-no-script)', () => {
  it('warns on a bare Container with no script', () => {
    const diagnostic = expectDiagnostic(scene(node('Container')), {
      ruleName: 'container-no-script',
      severity: 'warning',
    });
    expect(diagnostic.message).toContain('Container');
  });

  it('passes a Container with a script attached', () => {
    expectNoDiagnostic(scene(node('Container', { script: 'ExtResource("1_abc")' })), {
      ruleName: 'container-no-script',
    });
  });

  it('never fires on a Container SUBCLASS — the engine guard is get_class() == "Container", exact', () => {
    expectNoDiagnostic(scene(node('VBoxContainer')), { ruleName: 'container-no-script' });
  });

  it('never fires on unrelated node types', () => {
    expectNoDiagnostic(scene(node('Control')), { ruleName: 'container-no-script' });
  });
});
