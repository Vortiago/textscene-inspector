/**
 * Every declared PropertyListHelper family that drops a write past its count has a past-count rule,
 * and a family that assigns one has none. The rule is found through the registry, so a slice that
 * forgets to declare it fails here.
 */
import { describe, expect, it } from 'vitest';
import { ruleRegistry } from './RuleRegistry.js';
import type { IndexedFamily } from '../godot/classdb/indexedFamily.js';
import * as declarations from '../godot/classdb/propertyListFamilies.js';
import { node, scene, lint } from './testing/testkit';
import { controlRoutes } from './testing/propertyListRoutes/controls.js';
import '../nodes/2d/ui/itemlist/index.linter.js';
import '../nodes/2d/ui/tabbar/index.linter.js';
import '../nodes/2d/ui/tabcontainer/index.linter.js';
import '../nodes/2d/ui/menubutton/index.linter.js';
import '../nodes/2d/ui/optionbutton/index.linter.js';
import '../nodes/windows/popupmenu/index.linter.js';
import '../nodes/windows/filedialog/index.linter.js';

const pastCountArmsOf = (family: IndexedFamily) =>
  ruleRegistry
    .getRulesForNodeType(family.owner)
    .flatMap((rule) => rule.meta.emits ?? [])
    .filter((arm) => arm.grounding.kind === 'engine' && arm.grounding.at === family.outOfBounds.at);

const families: IndexedFamily[] = Object.values(declarations);

describe.each(families)('$owner $prefix', (family) => {
  it('has a route row whose sample key sits in the declared family', () => {
    const sampleKeys = controlRoutes.filter((row) => row.type === family.owner).map((row) => row.sample);
    expect(sampleKeys.some((key) => key.startsWith(`${family.prefix}0/`))).toBe(true);
  });

  if (family.outOfBounds.policy === 'assigned') {
    it('has no past-count rule, since the helper assigns an index past the length', () => {
      expect(pastCountArmsOf(family)).toHaveLength(0);
    });
    return;
  }
  if (family.countKey.key === null) throw new Error(`${family.owner} drops writes but declares no count key`);
  const countKey = family.countKey.key;

  it('has a past-count rule grounded at the declared line', () => {
    expect(pastCountArmsOf(family).length).toBeGreaterThan(0);
  });

  it('reports an index at the count', () => {
    const properties = { [countKey]: 1, [`${family.prefix}1/leaf`]: '"x"' };
    const arms = pastCountArmsOf(family).map((arm) => arm.ruleName);
    const names = lint(scene(node(family.owner, properties))).map((diagnostic) => diagnostic.ruleName);
    expect(names.some((name) => arms.includes(name!))).toBe(true);
  });
});
