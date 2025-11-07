/**
 * Architecture validation tests
 * Ensures architectural patterns and self-registration stay consistent
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from './core/NodeRegistry';
import { ruleRegistry } from './linter/RuleRegistry';
import type { LintRule } from './linter/types';

// Import main index and linter index to trigger all self-registrations
import './index';
import './linter/index';

describe('Architecture: Self-Registration Pattern', () => {
  describe('Node Registry Self-Registration', () => {
    it('should have core renderer nodes registered', () => {
      const registeredTypes = nodeRegistry.getAllTypeNames();

      // Core 3D nodes
      expect(registeredTypes).toContain('Node3D');
      expect(registeredTypes).toContain('MeshInstance3D');

      // Light nodes
      expect(registeredTypes).toContain('OmniLight3D');
      expect(registeredTypes).toContain('DirectionalLight3D');
      expect(registeredTypes).toContain('SpotLight3D');
    });

    it('should have minimum number of registered renderers', () => {
      const registeredTypes = nodeRegistry.getAllTypeNames();
      // At minimum: Node3D, MeshInstance3D, 3 light types = 5
      expect(registeredTypes.length).toBeGreaterThanOrEqual(5);
    });

    it('should allow retrieval of registrations', () => {
      const node3dReg = nodeRegistry.getRegistration('Node3D');
      expect(node3dReg).toBeDefined();
      expect(node3dReg!.typeName).toBe('Node3D');
      expect(node3dReg!.parser).toBeDefined();
      expect(node3dReg!.renderer).toBeDefined();
    });
  });

  describe('Linter Rule Registry Self-Registration', () => {
    it('should have linter rules registered', () => {
      const rules = ruleRegistry.getRules();

      // Should have at least some rules
      expect(rules.length).toBeGreaterThan(0);

      // Check for specific known rules
      const ruleNames = rules.map((r: LintRule) => r.meta.name);

      // Known rules from implemented nodes
      const knownRules = [
        'valid-node3d-visibility',
        'valid-meshinstance3d-mesh',
        'valid-omnilight3d-properties',
        'valid-directionallight3d-properties',
        'valid-spotlight3d-properties',
      ];

      // At least some of these should exist
      const foundRules = knownRules.filter(rule => ruleNames.includes(rule));
      expect(foundRules.length).toBeGreaterThan(0);
    });

    it('should have rules with valid metadata', () => {
      const rules = ruleRegistry.getRules();
      const validCategories = ['validation', 'performance', 'best-practice'];

      rules.forEach((rule: LintRule) => {
        expect(rule.meta).toBeDefined();
        expect(rule.meta.name).toBeDefined();
        expect(rule.meta.description).toBeDefined();
        expect(validCategories).toContain(rule.meta.category);
        expect(rule.check).toBeDefined();
        expect(typeof rule.check).toBe('function');
      });
    });
  });
});

describe('Architecture: TscnRenderer Responsibilities', () => {
  it('should have a reasonable number of public methods', async () => {
    const { TscnRenderer } = await import('./core/TscnRenderer');

    const methodNames = Object.getOwnPropertyNames(TscnRenderer.prototype)
      .filter(name => name !== 'constructor');

    // TscnRenderer should delegate to managers, keeping its API surface small
    // This test ensures it doesn't become a god object again
    // If this number grows significantly, consider extracting more managers
    // Updated to 29 to account for camera management methods (getSceneCameras, switchToCamera)
    expect(methodNames.length).toBeLessThan(29);
  });
});

describe('Architecture: Package Structure', () => {
  it('should export core rendering components', async () => {
    const mainExports = await import('./index');

    // Main exports
    expect(mainExports.TscnRenderer).toBeDefined();
    expect(mainExports.TscnParser).toBeDefined();
    expect(mainExports.TscnPreviewUI).toBeDefined();
    expect(mainExports.SceneTreeViewer).toBeDefined();
    expect(mainExports.setLogAdapter).toBeDefined();
  });

  it('should export linter components', async () => {
    const linterExports = await import('./linter/index');

    expect(linterExports.Linter).toBeDefined();
    expect(linterExports.StrictTscnParser).toBeDefined();
    expect(linterExports.ruleRegistry).toBeDefined();
    expect(linterExports.validatorRegistry).toBeDefined();
  });
});

describe('Architecture: Manager Pattern (TscnRenderer)', () => {
  it('should delegate node lifecycle to managers', async () => {
    const { TscnRenderer } = await import('./core/TscnRenderer');

    // Check that delegation methods exist
    const renderer = TscnRenderer.prototype;
    expect(renderer.addNode).toBeDefined();
    expect(renderer.removeNode).toBeDefined();
    expect(renderer.updateNode).toBeDefined();
    expect(renderer.setNodeVisibility).toBeDefined();
  });

  it('should delegate selection to managers', async () => {
    const { TscnRenderer } = await import('./core/TscnRenderer');

    const renderer = TscnRenderer.prototype;
    expect(renderer.getNodePathAtScreenPosition).toBeDefined();
  });

  it('should delegate helpers to managers', async () => {
    const { TscnRenderer } = await import('./core/TscnRenderer');

    const renderer = TscnRenderer.prototype;
    expect(renderer.highlightNode).toBeDefined();
    expect(renderer.clearHighlight).toBeDefined();
    expect(renderer.showHoverEffect).toBeDefined();
    expect(renderer.clearHoverEffect).toBeDefined();
  });

  it('should delegate resource recovery to managers', async () => {
    const { TscnRenderer } = await import('./core/TscnRenderer');

    const renderer = TscnRenderer.prototype;
    expect(renderer.getMissingResources).toBeDefined();
    expect(renderer.provideResource).toBeDefined();
  });
});
