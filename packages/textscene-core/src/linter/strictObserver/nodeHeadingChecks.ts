/**
 * The refusals a `[node]` heading earns from its own attributes: a missing `name=`, and a root or override heading
 * that states nothing Godot can build from.
 */

import type { ParsedHeading } from '../../parser/utils.js';
import { isPropertyOverrideHeading } from '../../parser/utils.js';
import type { ParseError } from '../types.js';
import type { SectionOwner } from './sectionOwner.js';

export interface NodeHeadingContext {
  line: number;
  isRoot: boolean;
  owner: SectionOwner;
  /** Asked only for a type-less heading below the root. */
  hasInstancedAncestor(parent: string | undefined): boolean;
}

export function nodeHeadingErrors(heading: ParsedHeading, context: NodeHeadingContext): ParseError[] {
  const errors: ParseError[] = [];
  const nameError = missingNameError(heading, context);
  if (nameError) errors.push(nameError);
  const identifierError = missingIdentifierError(heading, context);
  if (identifierError) errors.push(identifierError);
  return errors;
}

function missingNameError(heading: ParsedHeading, { line, owner }: NodeHeadingContext): ParseError | null {
  if (heading.attributes.name) return null;
  return headingError('error', 'Node heading must have "name=" attribute', 'MISSING_NODE_NAME', line, owner);
}

/**
 * A heading without `type=` is TYPE_INSTANTIATED (resource_format_text.cpp:218-221): a claim, not a grammar error,
 * and the arms below report whether it can hold. A later heading with `instance_placeholder=` declares an
 * InstancePlaceholder (packed_scene.cpp:239-258).
 */
function missingIdentifierError(heading: ParsedHeading, context: NodeHeadingContext): ParseError | null {
  const { line, isRoot, owner } = context;
  if (isRoot && heading.attributes.instance_placeholder) {
    // Refused before anything instantiates, with ERR_FILE_CORRUPT (resource_format_text.cpp:247-251).
    return headingError(
      'error',
      'Root node heading states "instance_placeholder=", which Godot refuses: ' +
        '"Instance Placeholder can\'t be used for inheritance" (resource_format_text.cpp:247-251). ' +
        'The file does not load.',
      'INSTANCE_PLACEHOLDER_ROOT',
      line,
      owner
    );
  }
  // A heading that declares what it is takes neither arm below.
  if (!isPropertyOverrideHeading(heading)) return null;
  if (isRoot) {
    // `resource_format_text.cpp` sets the base scene only for `instance=` (:233-240; `index=` at :270-272 changes
    // nothing), so `ERR_FAIL_COND_V_MSG(n.type == TYPE_INSTANTIATED && base_scene_idx < 0, …)` refuses this (packed_scene.cpp:220).
    return headingError(
      'error',
      'Root node heading states no "type=" or "instance=", so Godot treats it as a node ' +
        'from an instanced scene with no base scene and refuses to instantiate the scene ' +
        '(packed_scene.cpp:220).',
      'MISSING_NODE_IDENTIFIER',
      line,
      owner
    );
  }
  // `packed_scene.cpp` looks the node up by name under its parent (:283), which finds it only inside content an
  // ancestor instanced: the root of an inherited scene, or a node with `instance=` above. `index=` is an ordering
  // hint and rescues nothing.
  if (context.hasInstancedAncestor(heading.attributes.parent)) return null;
  return headingError(
    'warning',
    'Node heading states no "type=" or "instance=" and no ancestor instances a scene, ' +
      'so Godot looks for it inside instanced content that is not there and drops it: ' +
      '"was modified from inside an instance, but it has vanished." (packed_scene.cpp:310).',
    'MISSING_NODE_IDENTIFIER',
    line,
    owner
  );
}

function headingError(
  severity: ParseError['severity'],
  message: string,
  code: string,
  line: number,
  owner: SectionOwner
): ParseError {
  return { severity, message, line, column: 1, code, ...owner };
}
