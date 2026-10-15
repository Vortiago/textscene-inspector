/**
 * Runs the resource rules over every resource section of a file: each `[sub_resource]`, named by its
 * `id=`, and a `.tres`'s `[resource]` body. Godot loads each section once, so a finding reports once,
 * on the line of the property it names, or on the section's heading where the section omits it.
 */

import type { BuiltSection, RawScene } from '../parser/types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { resourceRuleRegistry, type ResourceRule } from './ResourceRuleRegistry.js';
import { armDiagnostic } from './ruleArms.js';
import { headingLocation, propertyLocation } from './sourceLocation.js';
import type { Diagnostic, SourceLines } from './types.js';

interface ResourceSection {
  readonly built: BuiltSection;
  readonly name: string;
  readonly type: string;
  readonly data: Readonly<Record<string, string>>;
}

function resourceSections(scene: RawScene): ResourceSection[] {
  const sections: ResourceSection[] = scene.internalResources.map((resource) => ({
    built: resource,
    name: resource.id,
    type: resource.type,
    data: resource.data,
  }));
  const { mainResource, resourceType } = scene;
  if (mainResource && resourceType) {
    sections.push({ built: mainResource, name: '<unknown>', type: resourceType, data: mainResource.data });
  }
  return sections;
}

/** Each finding of every resource rule, in file order. */
export function resourceRuleDiagnostics(scene: RawScene, lines: SourceLines): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const section of resourceSections(scene)) {
    for (const rule of resourceRuleRegistry.getRulesForResourceType(section.type)) {
      checkSection(rule, section, lines, diagnostics);
    }
  }
  return diagnostics;
}

/** A throw is the rule's own diagnostic, as in `Linter.lintNode`, so the other rules still report. */
function checkSection(
  rule: ResourceRule,
  section: ResourceSection,
  lines: SourceLines,
  into: Diagnostic[]
): void {
  const heading = headingLocation(lines, section.built);
  try {
    for (const { arm, message, property } of rule.check(section.data)) {
      if (!rule.meta.emits.includes(arm)) {
        throw new Error(`reported '${arm.ruleName}', which its emits does not declare`);
      }
      const location = propertyLocation(lines, section.built, property) ?? heading;
      into.push(armDiagnostic(arm, section, message, location));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    into.push(
      armDiagnostic(
        FILE_DIAGNOSTICS.ruleCrashed,
        section,
        `Rule '${rule.meta.name}' threw while linting '${section.name}': ${reason}. ` +
          'Its own findings for this resource are missing; every other rule ran.',
        heading
      )
    );
  }
}
