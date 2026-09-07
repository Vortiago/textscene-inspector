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
import { SCENE_ROOT_PATH, getAncestorPaths, joinPath, resolveParentPath } from '../utils/nodePath.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { ownsNilMessage } from './propertyValidator.js';
import { INSTANCE_PLACEHOLDER_TYPE, isNilLiteral } from '../godot/index.js';
import { resolveDeprecatedProperty } from '../godot/deprecated.js';

/**
 * Creates a simple TscnNode without using NodeRegistry (avoids three.js dependency)
 *
 * `properties` and `rawProperties` are the SAME bag here, which is what the
 * lenient tree means by `rawProperties` too — its `properties` holds the typed
 * shape a slice parsed out, so the raw literals live only in the second field.
 * Publishing both means the raw bag has one name whichever parser produced the
 * node, and a helper the linter and the render path share needs no idea which
 * one it is holding. Pinned by `parser/rawPropertyParity.test.ts`. Same object,
 * so this costs a reference.
 */
function createSimpleNode(heading: ParsedHeading, properties: Record<string, string>): TscnNode {
  const node: TscnNode = {
    name: heading.attributes.name || '',
    // Use type if available, otherwise use index or instance identifier
    // Note: For index=/instance= nodes, type may be inferred from parent scene or remain as identifier
    type:
      heading.attributes.type ||
      (heading.attributes.instance_placeholder ? INSTANCE_PLACEHOLDER_TYPE : '') ||
      heading.attributes.index ||
      heading.attributes.instance ||
      '',
    properties,
    rawProperties: properties,
    children: [], // Will be populated by buildSceneTree
  };

  // Only set parent if it exists (optional property)
  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
  }

  if (isPropertyOverrideHeading(heading)) {
    node.overridesExistingNode = true;
  }
  if (heading.attributes.owner) node.owner = heading.attributes.owner;

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

    // The SECTION whose body the scan is inside, or null between/outside the
    // sections that own properties. Every refusal raised while it is set is
    // ABOUT that section, and nothing else in this seam knows which one — the
    // validator is handed a key and a value.
    //
    // A sub-resource counts: `onProperty` below runs the full validator set for
    // its body, so its own diagnostics need an owner too. The fields keep the
    // `node*` names `ParseError` publishes.
    let currentOwner: { nodeName: string; nodeType: string } | null = null;
    // `[node]` headings seen so far: heading 0 is the root and takes the
    // `else` arm of `packed_scene.cpp:206-221`, every later one the `i > 0` arm.
    let nodeHeadings = 0;
    // The node paths that instance a scene, so a type-less heading below one
    // names content that exists. Keys are FOLDED paths, so `./Rock` and `Rock`
    // are the one node Godot resolves them both to, and the scene's own root
    // sits at `SCENE_ROOT_PATH`: it joins the set when heading 0 carries
    // `instance=` and the scene therefore inherits
    // (resource_format_text.cpp:233-240).
    //
    // `instance_placeholder=` is NOT one of these. Godot builds an
    // InstancePlaceholder with no children (packed_scene.cpp:255), so a node
    // named under one still vanishes and still deserves the warning.
    const instancedPaths = new Set<string>();
    const hasInstancedAncestor = (parent: string | undefined): boolean => {
      if (instancedPaths.has(SCENE_ROOT_PATH)) return true;
      // The root is covered above; an absolute or empty path names nothing to
      // walk up from at all.
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
          // A malformed HEADING is the line that would have opened a section,
          // so it belongs to none — `currentOwner` is still the previous one
          // and must not be borrowed. A malformed property line inside a
          // section's body does belong to it.
          ...(error.code === 'INVALID_PROPERTY_FORMAT' ? currentOwner : null),
        });
      },

      onSectionStart: (heading, section, line) => {
        if (section !== 'node') {
          // A sub-resource is named by its `id=`, which is what tells one
          // `[sub_resource type="CircleShape2D"]` from the four beside it — and
          // resource validators run over its body, so `radius = -1.0` there
          // reported `<unknown>` and left the author to find it by eye.
          //
          // Every other section clears the stamp: `ext_resource` and
          // `gd_scene`/`gd_resource` carry no validated properties, and a
          // `[resource]` body is the file's own single resource, which no id
          // identifies.
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
        // A heading without `type=` is TYPE_INSTANTIATED — `//no type? assume
        // this was instantiated` (resource_format_text.cpp:218-221) — which is
        // a claim, not a grammar error, and what the arms below report is
        // whether the claim can hold.
        //
        // Heading 0: only `instance=` sets the base scene (:233-240; `index=`
        // at :270-272 changes nothing), and without one the instantiate is
        // refused — `ERR_FAIL_COND_V_MSG(n.type == TYPE_INSTANTIATED &&
        // base_scene_idx < 0, …)` (packed_scene.cpp:220). A placeholder there
        // is refused earlier still: "Instance Placeholder can't be used for
        // inheritance", ERR_FILE_CORRUPT (resource_format_text.cpp:247-251).
        //
        // Any later heading: `instance_placeholder=` declares an
        // InstancePlaceholder (packed_scene.cpp:239-258); otherwise the node
        // is looked up by name under its parent (:283), which finds it only
        // inside content some ancestor instanced — the root of an inherited
        // scene, or a node with `instance=` above. With no such ancestor the
        // lookup fails and Godot drops the node: `"… was modified from inside
        // an instance, but it has vanished."` (:310). `index=` is an ordering
        // hint and rescues nothing.
        const isRootHeading = nodeHeadings++ === 0;
        const { instance, instance_placeholder: placeholder, parent, name } = heading.attributes;
        if (instance) {
          // An empty `parent=` joins as the root's own child: the lookup
          // returns null (node.cpp:1894) and the editor build's
          // vanished-parent fallback re-parents the node to the scene root
          // under its own name, the rename at :562 skipped because
          // `old_parent_path` is empty too (packed_scene.cpp:209-214, inside
          // `#ifdef DEBUG_ENABLED`). A release export has no fallback and sends
          // the node to `stray_instances` (:549) instead, so nothing below it
          // loads there either way.
          //
          // A path that resolves against nothing — an absolute one, or a `..`
          // above the root — leaves `parentPath` null: the fallback re-roots
          // the heading under a renamed path no other heading in the file can
          // spell, so the instance vouches for none.
          const parentPath = parent ? resolveParentPath(parent) : SCENE_ROOT_PATH;
          // A heading with no `name=` identifies no node, so it vouches for
          // none either. The root is the exception — it is the scene root
          // whatever it is called.
          if (isRootHeading) instancedPaths.add(SCENE_ROOT_PATH);
          else if (name && parentPath !== null) instancedPaths.add(joinPath(parentPath, name));
        }

        if (isRootHeading && placeholder) {
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

      onProperty: (_section, ownerType, key, value, line, isMultiline) => {
        // Skip validation for multi-line values (shader code, label text) and
        // for properties without a typed owner (index=/instance= nodes,
        // ext_resource/gd_scene sections).
        if (isMultiline || !ownerType) return;

        // The key as written first; where nothing claims that spelling, the
        // pair the engine applies — `godot/deprecated.ts` resolves the alias
        // and transforms the value — and the diagnostic then names both,
        // because the canonical key appears nowhere in the file.
        let lookupKey = key;
        let lookupValue = value;
        let validator = validatorRegistry.findValidator(ownerType, key);
        if (!validator) {
          const resolved = resolveDeprecatedProperty(ownerType, key, value);
          if (resolved.key === key) return;
          validator = validatorRegistry.findValidator(ownerType, resolved.key);
          if (!validator) return;
          lookupKey = resolved.key;
          lookupValue = resolved.value;
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

        // `null` is a legal Variant literal anywhere a value is expected
        // (variant_parser.cpp:699), so a per-type "must be a number" / "must be
        // a boolean" reads as a parse failure and says the wrong thing. The
        // validator is still the authority on WHETHER this slot takes it — a
        // resource slot does, and returns no error above — but where it does
        // not, the accurate claim is what the engine does instead. NIL converts
        // strictly only to OBJECT (variant.cpp:543-544), so every other slot
        // takes the type's zero. Measured on 4.6.3, `Control`:
        // `texture_filter = null` stores 0 and `visible = null` stores FALSE.
        //
        // The message does NOT contrast with the property's default, which a
        // validator does not carry and this seam cannot look up:
        // `CanvasItem::texture_filter` defaults to TEXTURE_FILTER_PARENT_NODE,
        // which IS 0 (canvas_item.h:123), so the stored value there is the
        // default.
        //
        // The claim is about a slot whose CONVERSION discards the null, and it
        // is exactly as narrow as that. Two kinds of refusal answer for the
        // null themselves and keep their message, which is what
        // `ownsNilMessage` asks: a key-level verdict rejects every value
        // because the class has no such slot, so "this slot stores zero
        // instead" describes a slot that does not exist and hides the removal's
        // own reason; and a nil verdict is an OBJECT slot whose setter refuses
        // the null with an `ERR_FAIL_COND(...is_null())`, so nothing is stored
        // at all and only that refusal carries the guard's `file:line`.
        //
        // The severity moves with the message. What is being reported is the
        // Variant binding narrowing the literal on the way IN, which ADR-0032
        // puts at the CONVERSION tier: the setter receives the type's zero and
        // refuses nothing, so the file loads exactly as `hframes = 5.5` does.
        // The validator's own tier answers a question this branch has replaced.
        //
        // Line, column and code stay the validator's, so the diagnostic keeps
        // anchoring on the value.
        //
        // Both verdicts ride on the ERROR, because neither is knowable from the
        // function this seam is handed: `findValidator` returns a family's
        // dispatcher rather than the leaf branch that refused, and
        // `withFiniteGuard` returns a wrapper rather than either. Rewriting a
        // refusal that carries one claims a slot stores zero where none does,
        // and reports a dropped write as a warning.
        if (isNilLiteral(value) && !ownsNilMessage(error)) {
          errors.push({
            ...error,
            ...currentOwner,
            severity: 'warning',
            message:
              `Property '${key}' is ${value.trim()}, which this slot cannot hold: Godot stores ` +
              `the type's zero value instead.`,
          });
          return;
        }
        errors.push({ ...error, ...currentOwner });
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
