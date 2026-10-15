/**
 * One warning per node property whose reference resolves to a class the slot's
 * `PROPERTY_HINT_RESOURCE_TYPE` hint excludes with a `-` prefix. The setter keeps the value, and the
 * editor never offers the class (`editor_resource_picker.cpp:827-833`), so the value is outside the
 * property's UI hint: a warning (ADR-0032).
 */

import type { RawNode, RawScene } from '../parser/types.js';
import type { Diagnostic, SourceLines } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { resolveResourceSlot } from './resourceChecker.js';
import { propertyLocation } from './sourceLocation.js';
import { excludingHint } from '../godot/resourceTypeHint.js';

function sweep(scene: RawScene, owner: RawNode, lines: SourceLines, into: Diagnostic[]): void {
  for (const [key, value] of Object.entries(owner.rawProperties)) {
    const hint = excludingHint(owner.type, key);
    if (!hint) continue;
    const slot = resolveResourceSlot(scene, value);
    if (slot.kind !== 'resolved' || !hint.excluded.includes(slot.type)) continue;
    into.push(
      armDiagnostic(
        FILE_DIAGNOSTICS.resourceTypeExcludedByHint,
        owner,
        `Property '${key}' holds the type ${slot.type}, which the hint of ${hint.declaredBy}.${key} ` +
          `("${hint.hintString}") excludes. The editor never offers this type for the slot.`,
        propertyLocation(lines, owner, key)
      )
    );
  }
}

/** Each excluded resource type, on the line of the node property that holds it. */
export function excludedResourceTypeDiagnostics(scene: RawScene, lines: SourceLines): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const visit = (node: RawNode): void => {
    sweep(scene, node, lines, diagnostics);
    for (const child of node.children) visit(child);
  };
  for (const node of scene.nodes) visit(node);
  return diagnostics;
}
