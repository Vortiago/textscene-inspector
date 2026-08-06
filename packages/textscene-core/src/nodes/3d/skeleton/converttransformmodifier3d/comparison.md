---
type: ConvertTransformModifier3D
category: 3D
status: linter-only
fixture: unit-convert-transform-modifier-3d.tscn
# image: unit-convert-transform-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# ConvertTransformModifier3D

ConvertTransformModifier3D reads ONE scalar off a reference bone or node (a position along
an axis, a roll angle about it, or a scale factor), remaps it from the reference range onto
the apply range, and writes it back as a different kind of transform on the apply bone. That
is the whole point of the node: position in, rotation out. It draws nothing at runtime, so
the previewer renders it as a transform-only group (ADR-0008): its children still show, and
that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `setting_count` | `2` | two settings entries, so `settings/0/` and `settings/1/` exist |
| `settings/0/apply/transform_mode` | `0` | writes the result as a position |
| `settings/0/apply/axis` | `1` | along Y |
| `settings/0/apply/range_min` / `range_max` | `-0.5` / `0.5` | the output band, in metres for Position mode |
| `settings/0/reference/transform_mode` | `1` | reads a rotation off the reference bone |
| `settings/0/reference/axis` | `2` | the roll about Z |
| `settings/0/reference/range_min` / `range_max` | `-1.5707964` / `1.5707964` | plus/minus a quarter turn, in RADIANS: the hint is `radians_as_degrees`, so the inspector shows plus/minus 90 |
| `settings/0/relative` | `true` | reads the reference pose relative to its rest |
| `settings/0/additive` | `false` | replaces the apply bone's pose rather than adding to it |
| `settings/0/apply_bone` | `4` | a BoneConstraint3D leaf, sitting beside the `apply/` group whose name it shares a prefix with |
| `settings/1/apply/transform_mode` | `2` | writes the result as a scale |
| `settings/1/apply/range_min` / `range_max` | `0.0` / `2.0` | the output band; Scale mode's hint floors it at 0 |
| `settings/1/reference/transform_mode` | `0` | reads a position |
| `settings/1/reference_node` | `NodePath("../../Target")` | a node reference rather than a bone one, which is why entry 1 carries no `relative` |

No visible mark for any of them: the modifier needs a skinned Skeleton3D pose to act on,
and the previewer runs no skeleton modification.

## Divergences

None visible in this fixture. The previewer never applies the constraint, so a scene where
the modifier would visibly move a bone renders as the unmodified rest pose.

## Linting

<!-- lint:begin ConvertTransformModifier3D -->
<!-- lint:end -->

ConvertTransformModifier3D has no `parser.ts` of its own: it registers `parseNode3D`
directly (index.ts), so `setting_count` and every `settings/<i>/` leaf is validated but
never read back into the scene tree. An out-of-range value is reported and then dropped
rather than substituted, exactly as for the other transform-only modifiers.

Three things about this slice's linting are worth naming.

The `settings/` family nests. Eight of the ten leaves this class adds are TWO segments
below the index (`settings/0/apply/transform_mode`), which the shared
`indexedFamilyValidator` reaches by ending the index at the first `/` after it and treating
everything past that as the leaf name. The family is registered under the plain `settings/*`
wildcard rather than the glued-index `settings/#/*`, because the registry's index matcher
routes a single leaf segment only. Note `apply_bone` beside `apply/axis`: one is
BoneConstraint3D's flat leaf, the other this class's nested group, and the split keeps them
apart.

The `settings/` prefix is shared with BoneConstraint3D, which contributes `amount`, the two
bone names and the reference keys to the same family. This slice validates only the ten
leaves ConvertTransformModifier3D adds and hands the base's seven back to the
BoneConstraint3D registration, so their bounds still fire.

The range bounds are a RULE, not validators. Each `range_min` / `range_max` pair carries a
`PROPERTY_HINT_RANGE` whose hint string Godot picks at runtime from the sibling
`transform_mode` beside it: Position opens both ends and so bounds nothing, Rotation closes
both at plus/minus PI radians, and Scale floors at 0. A per-property validator cannot see
that sibling, so the four range validators check only the float format, and the
mode-conditional bound lives in `linter.ts`, where the whole property bag is readable. Every
such report is a **warning**: the setters assign straight through, so Godot keeps the value
and only the inspector's spinner cannot reach it.
