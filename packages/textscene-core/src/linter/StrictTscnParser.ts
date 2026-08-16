/**
 * Strict TSCN parser for linting
 *
 * A thin adapter over TscnParserCore's single scanning loop: it attaches a
 * ParseObserver that collects syntax/format errors as ParseError[], performs
 * strict heading checks (missing node name/identifier), and runs registered
 * property validators. The lenient renderer path uses the same loop with no
 * observer — one scanning loop, two adapters.
 */

import type { TscnNode } from '../parser/types.js';
import type { ParseError, StrictParseResult } from './types.js';
import { TscnParserCore } from '../parser/TscnParserCore.js';
import type { ParseObserver } from '../parser/TscnParserCore.js';
import { isPropertyOverrideHeading, type ParsedHeading } from '../parser/utils.js';
import { validatorRegistry } from './ValidatorRegistry.js';

/**
 * Creates a simple TscnNode without using NodeRegistry (avoids three.js dependency)
 */
function createSimpleNode(heading: ParsedHeading, properties: Record<string, string>): TscnNode {
  const node: TscnNode = {
    name: heading.attributes.name || '',
    // Use type if available, otherwise use index or instance identifier
    // Note: For index=/instance= nodes, type may be inferred from parent scene or remain as identifier
    type: heading.attributes.type || heading.attributes.index || heading.attributes.instance || '',
    properties,
    children: [], // Will be populated by buildSceneTree
  };

  // Only set parent if it exists (optional property)
  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
  }

  if (isPropertyOverrideHeading(heading)) {
    node.overridesExistingNode = true;
  }

  // Carry an instance reference on the dedicated TscnNode field rather than
  // smuggling a `__instance` key into the property schema. (An `index=`-only
  // editable-instance child has no consumer here; its index is already
  // reflected in `type` via the fallback above.)
  if (heading.attributes.instance) {
    node.instance = heading.attributes.instance;
  }

  return node;
}

export class StrictTscnParser {
  private core = new TscnParserCore();

  /**
   * Strictly parse TSCN content
   * @param content - TSCN file content
   * @returns Parse result with errors or parsed scene
   */
  parse(content: string): StrictParseResult {
    const errors: ParseError[] = [];

    const observer: ParseObserver = {
      onError: (error) => {
        errors.push({
          severity: 'error',
          message: error.message,
          line: error.line,
          column: error.column,
          code: error.code,
        });
      },

      onSectionStart: (heading, section, line) => {
        if (section !== 'node') return;

        if (!heading.attributes.name) {
          errors.push({
            severity: 'error',
            message: 'Node heading must have "name=" attribute',
            line,
            column: 1,
            code: 'MISSING_NODE_NAME',
          });
        }
        // A heading with none of `type=` / `index=` / `instance=` is LEGAL:
        // Godot's parser takes the absence as a claim rather than as a defect —
        // `else { type = SceneState::TYPE_INSTANTIATED; //no type? assume this
        // was instantiated }` (resource_format_text.cpp:218-221). So this is
        // not a grammar error, and calling it one rejected both canonical
        // valid shapes: a property override on a child of an `instance=`
        // sub-scene, and an inherited scene.
        //
        // It stays a WARNING because the claim can still be false, and Godot
        // says so itself at load — `"… was modified from inside an instance,
        // but it has vanished."` (packed_scene.cpp:309-311) — when nothing
        // instantiates the node the heading is standing in for. Godot's writer
        // emits `index=` for the real cases, so a bare heading is usually the
        // residue of a sub-scene that failed to resolve.
        if (
          !heading.attributes.type &&
          !heading.attributes.index &&
          !heading.attributes.instance
        ) {
          errors.push({
            severity: 'warning',
            message:
              'Node heading states no "type=", "index=" or "instance=", so Godot treats it as ' +
              'a node from an instanced scene. If nothing instantiates it, the node vanishes at load.',
            line,
            column: 1,
            code: 'MISSING_NODE_IDENTIFIER',
          });
        }
      },

      onProperty: (_section, ownerType, key, value, line, isMultiline) => {
        // Skip validation for multi-line values (shader code, label text) and
        // for properties without a typed owner (index=/instance= nodes,
        // ext_resource/gd_scene sections).
        if (isMultiline || !ownerType) return;

        const validator = validatorRegistry.findValidator(ownerType, key);
        if (!validator) return;

        const error = validator(key, value, line);
        if (!error) return;

        // `null` is a legal Variant literal anywhere a value is expected
        // (variant_parser.cpp:699), so a per-type "must be a number" / "must be
        // a boolean" reads as a parse failure and says the wrong thing. The
        // validator is still the authority on WHETHER this slot takes it — a
        // resource slot does, and returns no error above — but where it does
        // not, the accurate claim is what the engine does instead. NIL converts
        // strictly only to OBJECT (variant.cpp:543-544), so every other slot
        // takes the type's zero. Measured on 4.6.3, `Control`:
        // `texture_filter = null` stores 0 and `visible = null` stores FALSE
        // against a default of true.
        if (value.trim() === 'null') {
          errors.push({
            severity: error.severity,
            message:
              `Property '${key}' is null, which this slot cannot hold: Godot stores the type's ` +
              `zero value rather than the property's default.`,
            line,
            column: 1,
            code: error.code,
          });
          return;
        }
        errors.push(error);
      },
    };

    const scene = this.core.parse(content, createSimpleNode, observer);

    // The scene comes back even when a property failed, because a bad value
    // does not invalidate the tree: the scanner still produced every node with
    // its name, type and parent. Withholding it made `Linter` skip the whole
    // rule phase, so ONE out-of-range property anywhere in a file silenced
    // every semantic rule in it - a missing CollisionShape2D on an unrelated
    // node included. It also made any rule whose condition a validator already
    // rejects permanently unreachable, since the validator's error suppressed
    // the phase that would have run the rule.

    return { errors, scene };
  }
}
