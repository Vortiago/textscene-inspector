/**
 * Strict TSCN parser for linting: an adapter over TscnParserCore's scanning loop. Its ParseObserver collects syntax and
 * format errors as ParseError[], checks headings strictly and runs the registered property validators. The lenient
 * renderer runs the same loop with no observer.
 */

import type { TscnInternalResource, TscnNode } from '../parser/types.js';
import type { ParseError, SectionLines, StrictParseResult } from './types.js';
import { TscnParserCore } from '../parser/TscnParserCore.js';
import type { ParseObserver } from '../parser/TscnParserCore.js';
import { isPropertyOverrideHeading, type ParsedHeading } from '../parser/utils.js';
import { SCENE_ROOT_PATH, getAncestorPaths, joinPath, resolveParentPath } from '../utils/nodePath.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { ownsNilMessage } from './propertyValidator.js';
import { INSTANCE_PLACEHOLDER_TYPE, isNilLiteral } from '../godot/index.js';

/**
 * A TscnNode built without NodeRegistry, so without three.js. `properties` and `rawProperties` are the same bag, as the
 * lenient tree's `rawProperties` holds the raw literals too, so a helper the linter and the renderer share reads one name
 * from either parser (`parser/rawPropertyParity.test.ts`). The shared object costs a reference.
 */
function createSimpleNode(heading: ParsedHeading, properties: Record<string, string>): TscnNode {
  const node: TscnNode = {
    name: heading.attributes.name || '',
    // The heading's own `type=`, else the identifier it states instead. Not `index=`: that is the sibling position
    // Godot restores an override at. An override heading states no type, and every reader treats empty as unknowable.
    type:
      heading.attributes.type ||
      (heading.attributes.instance_placeholder ? INSTANCE_PLACEHOLDER_TYPE : '') ||
      heading.attributes.instance ||
      '',
    properties,
    rawProperties: properties,
    children: [], // buildSceneTree fills it.
  };

  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
  }

  if (isPropertyOverrideHeading(heading)) {
    node.overridesExistingNode = true;
  }
  if (heading.attributes.owner) node.owner = heading.attributes.owner;

  // The instance reference goes on the dedicated TscnNode field, not a `__instance` key in the property schema.
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
    const lines = new Map<TscnNode | TscnInternalResource, SectionLines>();
    // The open section's property lines, which `onSectionBuilt` files under what the section
    // builds. A fresh map per heading, since the finished one is kept.
    let propertyLines = new Map<string, number>();

    // The section whose body the scan is inside, or null outside the sections that own properties. Every refusal raised
    // while it is set is about that section, and the validator knows only a key and a value. A sub-resource counts, since
    // `onProperty` validates its body. The fields keep the `node*` names `ParseError` publishes.
    let currentOwner: { nodeName: string; nodeType: string } | null = null;
    // `[node]` headings seen so far: heading 0 is the root and takes the
    // `else` arm of `packed_scene.cpp:206-221`, every later one the `i > 0` arm.
    let nodeHeadings = 0;
    // The node paths that instance a scene, so a type-less heading below one names content that exists. Keys are folded
    // paths (`./Rock` and `Rock` are one node), and the root joins as `SCENE_ROOT_PATH` when heading 0 carries `instance=`
    // (resource_format_text.cpp:233-240). Not `instance_placeholder=`: an InstancePlaceholder has no children
    // (packed_scene.cpp:255), so a node named under one still vanishes.
    const instancedPaths = new Set<string>();
    const hasInstancedAncestor = (parent: string | undefined): boolean => {
      if (instancedPaths.has(SCENE_ROOT_PATH)) return true;
      // The root is covered above. An absolute or empty path names nothing to
      // walk up from.
      const path = resolveParentPath(parent);
      if (!path) return false;
      return instancedPaths.has(path) || getAncestorPaths(path).some((p) => instancedPaths.has(p));
    };

    const observer: ParseObserver = {
      onError: (error) => {
        errors.push({
          severity: 'error',
          message: error.message,
          line: error.line,
          column: error.column,
          code: error.code,
          // A malformed heading would have opened a section, so it belongs to none and must not borrow the
          // previous `currentOwner`. A malformed property line belongs to its section.
          ...(error.code === 'INVALID_PROPERTY_FORMAT' ? currentOwner : null),
        });
      },

      onSectionStart: (heading, section, line) => {
        propertyLines = new Map();
        if (section !== 'node') {
          // A sub-resource is named by its `id=`, which tells one `[sub_resource type="CircleShape2D"]` from its
          // siblings. Every other section clears the owner: `ext_resource`, `gd_scene` and `gd_resource` carry no
          // validated properties, and a `[resource]` body is the file's own single resource, which no id identifies.
          currentOwner =
            section === 'sub_resource'
              ? {
                  nodeName: heading.attributes.id ?? '<unknown>',
                  nodeType: heading.attributes.type ?? '<unknown>',
                }
              : null;
          return;
        }

        currentOwner = {
          nodeName: heading.attributes.name ?? '<unknown>',
          nodeType: heading.attributes.type ?? '<unknown>',
        };

        if (!heading.attributes.name) {
          errors.push({
            severity: 'error',
            message: 'Node heading must have "name=" attribute',
            line,
            column: 1,
            code: 'MISSING_NODE_NAME',
            ...currentOwner,
          });
        }
        // A heading without `type=` is TYPE_INSTANTIATED (resource_format_text.cpp:218-221): a claim, not a grammar
        // error, and the arms below report whether it can hold. A later heading with `instance_placeholder=` declares
        // an InstancePlaceholder (packed_scene.cpp:239-258).
        const isRootHeading = nodeHeadings++ === 0;
        const { instance, instance_placeholder: placeholder, parent, name } = heading.attributes;
        if (instance) {
          // An empty `parent=` reads as the root here. That is no engine claim: it faults the load itself
          // (resource_format_text.cpp:206-207), which `empty-parent-path` reports, and it keeps every other heading
          // checkable. The root heading is the scene root whatever its name, and a heading with no `name=` vouches for none.
          if (isRootHeading) {
            instancedPaths.add(SCENE_ROOT_PATH);
          } else if (name) {
            // Null where the path resolves against nothing (an absolute path, or `..` above the root): the fallback
            // re-roots the heading under a path no other heading can spell, so it vouches for none.
            const parentPath = parent ? resolveParentPath(parent) : SCENE_ROOT_PATH;
            if (parentPath !== null) instancedPaths.add(joinPath(parentPath, name));
          }
        }

        if (isRootHeading && placeholder) {
          // Refused before anything instantiates, with ERR_FILE_CORRUPT (resource_format_text.cpp:247-251).
          errors.push({
            severity: 'error',
            message:
              'Root node heading states "instance_placeholder=", which Godot refuses: ' +
              '"Instance Placeholder can\'t be used for inheritance" (resource_format_text.cpp:247-251). ' +
              'The file does not load.',
            line,
            column: 1,
            code: 'INSTANCE_PLACEHOLDER_ROOT',
            ...currentOwner,
          });
        } else if (!isPropertyOverrideHeading(heading)) {
          // The heading declares what it is, so neither arm below applies.
        } else if (isRootHeading) {
          // `resource_format_text.cpp` sets the base scene only for `instance=` (:233-240; `index=` at :270-272 changes
          // nothing), so `ERR_FAIL_COND_V_MSG(n.type == TYPE_INSTANTIATED && base_scene_idx < 0, …)` refuses this (packed_scene.cpp:220).
          errors.push({
            severity: 'error',
            message:
              'Root node heading states no "type=" or "instance=", so Godot treats it as a node ' +
              'from an instanced scene with no base scene and refuses to instantiate the scene ' +
              '(packed_scene.cpp:220).',
            line,
            column: 1,
            code: 'MISSING_NODE_IDENTIFIER',
            ...currentOwner,
          });
        } else if (!hasInstancedAncestor(parent)) {
          // `packed_scene.cpp` looks the node up by name under its parent (:283), which finds it only inside content
          // an ancestor instanced: the root of an inherited scene, or a node with `instance=` above. `index=` is an
          // ordering hint and rescues nothing.
          errors.push({
            severity: 'warning',
            message:
              'Node heading states no "type=" or "instance=" and no ancestor instances a scene, ' +
              'so Godot looks for it inside instanced content that is not there and drops it: ' +
              '"was modified from inside an instance, but it has vanished." (packed_scene.cpp:310).',
            line,
            column: 1,
            code: 'MISSING_NODE_IDENTIFIER',
            ...currentOwner,
          });
        }
      },

      onProperty: (_section, ownerType, key, value, line, isMultiline, stored) => {
        // The key the scan stores the value under, so a reader of the bag finds the line.
        propertyLines.set(stored.key, line);

        // Skip validation for multi-line values (shader code, label text) and
        // for properties without a typed owner (index=/instance= nodes,
        // ext_resource/gd_scene sections).
        if (isMultiline || !ownerType) return;

        // The key as written first. Where nothing claims that spelling, the pair the engine applies
        // (`godot/deprecated.ts` resolves the alias and transforms the value), and the diagnostic names both,
        // because the canonical key appears nowhere in the file.
        let lookupKey = key;
        let lookupValue = value;
        let validator = validatorRegistry.findValidator(ownerType, key);
        if (!validator) {
          if (stored.key === key) return;
          validator = validatorRegistry.findValidator(ownerType, stored.key);
          if (!validator) return;
          lookupKey = stored.key;
          lookupValue = stored.value;
        }

        const found = validator(lookupKey, lookupValue, line);
        if (!found) return;
        const error =
          lookupKey === key
            ? found
            : {
                ...found,
                // `propertyError` anchors the column on the key it was handed;
                // rebased so it lands on the value after the key as written.
                column: found.column - lookupKey.length + key.length,
                message: `Property '${key}' is applied as '${lookupKey} = ${lookupValue}': ${found.message}`,
              };

        // `null` is legal anywhere (variant_parser.cpp:699), and NIL converts strictly only to OBJECT (variant.cpp:543-544):
        // on 4.6.3 `Control`, `texture_filter = null` stores 0 and `visible = null` stores false. `ownsNilMessage` keeps a key
        // verdict (no such slot) and a nil verdict (an OBJECT setter's `ERR_FAIL_COND(...is_null())`, the one refusal with
        // a `file:line`). Both ride on the error: `findValidator` returns a dispatcher and `withFiniteGuard` a wrapper.
        if (isNilLiteral(value) && !ownsNilMessage(error)) {
          errors.push({
            // Line, column and code stay the validator's, so the diagnostic anchors on the value.
            ...error,
            ...currentOwner,
            // ADR-0032's conversion tier: the setter receives the zero and refuses nothing, as for `hframes = 5.5`.
            severity: 'warning',
            // No contrast with the default, which this seam cannot look up: `CanvasItem::texture_filter` defaults to
            // TEXTURE_FILTER_PARENT_NODE, which is 0 (canvas_item.h:123).
            message:
              `Property '${key}' is ${value.trim()}, which this slot cannot hold: Godot stores ` +
              `the type's zero value instead.`,
          });
          return;
        }
        errors.push({ ...error, ...currentOwner });
      },

      onSectionBuilt: (built, headingLine) => {
        lines.set(built, { heading: headingLine, properties: propertyLines });
      },
    };

    const scene = this.core.parse(content, createSimpleNode, observer);

    // The scene comes back even when a property failed: a bad value does not invalidate the tree. Withholding it
    // would skip the rule phase, so one out-of-range property would silence every semantic rule in the file, and a
    // rule whose condition a validator rejects would never run.

    return { errors, scene, lines };
  }
}
