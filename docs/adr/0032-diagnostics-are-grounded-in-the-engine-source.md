# Diagnostics are grounded in the engine source, never in the class reference

- Status: Accepted
- Related: ADR-0001 (unified slice, React-free linter), `linter/rangeAdvisory.ts`,
  `linter/validators/v.ts`.

## Context

A magnitude threshold written from intuition, or from a sentence in Godot's class
reference, under a name like `EXTREME_LIGHT_ENERGY_MAX`, `LARGE_OMNI_RANGE` or
`MIN_RECOMMENDED_TRAVEL`, cites no source line and is often narrower than what the
engine accepts.

Such thresholds are measurably wrong. A bound of `0.1-0.3` on
`VehicleWheel3D.suspension_travel` would come from `doc/classes/VehicleWheel3D.xml`: "Try a
value between 0.1 and 0.3 depending on the type of car." The `.cpp` binds that property
`PROPERTY_HINT_NONE`, and `set_suspension_travel` assigns without a clamp, so the engine
states no range. Godot's own `truck_town` demo, the canonical VehicleBody3D example,
ships `2.0` on each of its wheels, so that advisory would fire on each wheel of the
reference implementation of the node it polices. A slice test written from the same
misreading would assert a warning for the value the demo uses.

A bound of `0.1-5` on `spot_attenuation` and `omni_attenuation` is also wrong: the engine
hints `"-10,10,…,or_greater,or_less"`. Thresholds of this kind would fire on the official Godot
demo projects in the vendored corpus.

Hint bounds are not grounds for an error either. A `PROPERTY_HINT_RANGE` constrains the
editor's inspector widget. A `.tscn` that carries a value outside it still loads and
runs. `set_volume_db` only `ERR_FAIL`s on NaN, and the `ERR_FAIL_INDEX` of
`Light3D::set_param` guards the parameter index, not the value. Both read like
enforcement and enforce nothing.

## Decision

Two taxonomies are in play, with different names. A **bound tier** is what a property's
bound may produce: **error**, **warning** or **nothing**. A **severity** is what a
reported diagnostic carries: `error`, `warning` or `info` (the `Severity` type in
`linter/types.ts`, the one CONTEXT.md defines). A bound tier never produces an `info`.
`info` exists only as a severity, fixed by a rule's `EmitGrounding` kind (see "How it is
enforced").

The engine source puts each property of a slice in one of three bound tiers. The fourth
row below is not a bound tier, and a slice must not declare it on a property. It is the
shared post-pass that runs over each int slot, described under "A binding-layer
conversion" below.

| Bound tier | Grounding | Severity |
| --- | --- | --- |
| **error** | The setter refuses or alters the value: an `ERR_FAIL*`, or a clamp/mask that silently changes what was written. | error |
| **warning** | The value lies outside what the property's own UI-control hint permits: `PROPERTY_HINT_RANGE`, `PROPERTY_HINT_LAYERS_*` or `PROPERTY_HINT_FLAGS` in its `ADD_PROPERTY`. | warning |
| **nothing** | `PROPERTY_HINT_NONE`, no hint, both hint ends open, or a bound that exists only in the class-reference prose. | no rule |
| **conversion**, shared, never declared by a slice | The Variant binding narrows the literal on the way IN, so the setter never sees what was written: `_to_int` truncating `5.5` to 5 (`variant.h:369-370`). | warning |

These rules decide the row of a property:

- **`,or_greater` opens the max end, and `,or_less` opens the min end.** An open end
  never produces a diagnostic. When both ends are open, the property gets none.
- **The hint is source, not prose.** It lives in the `.cpp` and states what the editor
  UI permits, which is reliable enough to warn on. The narrative advice of the class
  reference is not, and it never grounds a diagnostic on its own.
- **A hint is not enforcement.** It gives a warning, never an error. Only the setter's
  own behaviour can justify an error.
- **A binding-layer conversion is not the setter's behaviour either.** `_to_int` runs
  before the setter, which receives the narrowed int. `set_hframes` only sees the 5 that
  `hframes = 5.5` became. Measured on 4.6.3, that file loads and stores 5 with no engine
  complaint. The stored value still differs from the written one, so it is worth a
  warning. The error row is for what the setter itself does. This applies to each int
  slot, so it belongs to the shared `storedNotWritten` (`linter/validators/intSlot.ts`),
  not to a property. It runs after each bound, so a value that is both fractional and
  out of range reports the error.
- **A bit mask is two bound tiers, not one.** Where a setter stores `p_flags & MASK`, a
  bit outside the mask is dropped, which is the error row's "silently changes what was
  written". A bit inside the mask but absent from the `PROPERTY_HINT_FLAGS` list is kept
  unaltered and is only unreachable from the inspector, which is the warning row.
  `autowrap_trim_flags` is both: the mask keeps 224, and the hint offers 192. Membership
  is not a range, so neither bound tier can be a min/max bound. `maskedBitField` exists
  for this shape.

Each threshold carries the governing `file:line` in a comment beside it. A constant
named for a feeling and not a source (`EXTREME_*`, `LARGE_*`, `SMALL_*`,
`*_RECOMMENDED`) does not pass review without that citation.

### File scope is declared, not grounded

`legacy-format-version` cites no engine rule, because there is none. The text loader
compares the header's format version in three places, and each one is `>`:
`if (format_version > FORMAT_VERSION)` refuses a file as `ERR_FILE_UNRECOGNIZED`
(`resource_format_text.cpp:1141`, `:1331`, `:1369`). That file has no less-than
comparison and no `DISABLE_DEPRECATED` branch, and the Variant parser's tolerance for
Godot-3 spellings (`PoolByteArray`, `variant_parser.cpp:1410`) is not gated on the
version either. Godot 4.6.3 opens a `format=2` file and parses it with the current
grammar.

The linter declines it regardless. That is a decision about this tool's scope, not a
report about the engine. Version 3 gave ext/subresources their string ids ("Version 3:
New string ID for ext/subresources, breaks forward compat.", `resource_format_text.h:44`).
On a `format=2` file the reference rules read integer ids as dangling, and each bound is
judged against a grammar the file predates. Those diagnostics would be wrong, not only
noisy, so the file gets one info and nothing else.

Two consequences, both load-bearing:

- **It informs, never errors.** The file loads, and the claim is about this tool's scope,
  not about the engine: a `previewer-limitation`, which `severityFixedBy` fixes at
  **info**. An error would misstate the engine and would fail `lint:scenes` on content
  Godot accepts.
- **The current end is unbounded on purpose.** `FORMAT_VERSION = 4`
  (`resource_format_text.h:46`) is the accepted ceiling, and `FORMAT_VERSION_COMPAT = 3`
  (`:48`) is the saver's default. One 4.6.3 saver writes both. It chooses per file on
  whether a `PackedVector4Array` or a >64-byte `PackedByteArray` is present
  (`resource_format_text.cpp:1724-1732`, `:1770`, `:1798`). Neither is legacy. The
  vendored Godot demo projects (`scenes/demos`, `scenes/isometric`) ship both spellings
  side by side, and 4.6.3 opens either. A header that declares no format is current too
  (`} else { format_version = FORMAT_VERSION; }`, `:1147-1148`). A ceiling check would
  fire on current files as soon as a later engine raises `FORMAT_VERSION`, so there is
  none.

### Usage flags decide whether there is anything to ground

Before you ask which bound tier a property belongs to, ask whether it reaches a `.tscn`.
`_validate_property` and the usage flags answer that, and they are easy to misread in
both directions: as a removal that is not one, and as a hiding that is not one. A
property that never serialises needs no validator, and one that does must not be
reported as impossible. Three rules:

- **`PROPERTY_USAGE_NONE` removes storage.** The property is never written, so it gets
  no validator. That alone is not `registerUnavailable`. To model a key as removed is to
  claim a scene that carries it is wrong, and only a setter guard that refuses the write
  supports that claim. `SpinBox.exp_edit` and `FileDialog.dialog_text` are the cases
  where both hold.
- **`usage ^= PROPERTY_USAGE_STORAGE` can add storage back.** The XOR is a toggle, not a
  clear, so a property that reads as hidden in one configuration serialises in another.
  A key Godot writes in that mode must not be reported.
- **`PROPERTY_USAGE_NO_EDITOR` is `PROPERTY_USAGE_STORAGE`** (`object.h:132`), so it
  serialises. It hides a property from the inspector and does nothing else.
  `SpringBoneCollision3D.bone` and the `settings/<i>/…` bone indices carry it and are
  validated.

No guard can hold this rule. To verify a usage-flag reading means to read engine source
at test time, which `scripts/godot-source-decoupling.test.mjs` forbids, so the rule is
written here. A docblock on a registry method is not enough: `SpringBoneSimulator3D` and
`ChainIK3D` reached opposite verdicts on similar keys with the docblock in place.

### Which release decides

An error means that no supported Godot 4.x release accepts the value. A `.tscn` records
no engine version, so a bound that moved between releases follows the newer one:
`Viewport.canvas_item_default_texture_filter` has `PARENT_NODE` from 4.7, and the error
ceiling rises with it, even though the `ERR_FAIL_INDEX` of 4.6.3 refuses that value.
Otherwise the linter reports an error on a scene a supported editor wrote, which is the
failure this ADR prevents.

The tier moves the same way. `GPUParticles3D.transform_align` is an enforced 0-3 in
4.6.3 and a bare assignment in 4.7.2, so no release refuses it and only the hint bounds
it: a warning. A release that removes a guard lowers the tier. A release that adds one
does not raise it, because the older release still stores the value.

Citations stay 4.6.3-relative unless the comment names the release. The
`HINT_PREDATES_CAPTURE` of `hintImplementationParity` holds each value accepted ahead of
the ClassDB capture, and it empties when the capture is retaken.

## How it is enforced

A convention decays. The guards below hold. Each one closes one way that a diagnostic
can reject a value with nothing behind it.

**Each validator declares its kind.** A `PropertyValidator` carries one of three tags.
`formatOnly` rejects only values that never reach the property: text the tokeniser
refuses, or a type that `can_convert_strict` (`variant.cpp:536-830`) does not convert
into the slot, which `PackedScene` then drops silently at `packed_scene.cpp:492`, so no
citation is possible or needed. `grounding` rejects a real value, and names the
`file:line` that says so. `intSlot` reads an INT slot, where the authority is the
conversion itself, so the citation is always `variant.h:360-377`. The `v` DSL sets one by
construction: each combinator is either a `shape(…)` or takes a `Grounding`, and
`markIntSlot` adds the third. A hand-rolled validator carries none until its author
chooses, and `boundGrounding.test.ts` fails on it.

`intSlot` is a classification only for a validator with no bounds of its own. Otherwise
a bounded combinator would inherit a citation that vouches for a type conversion, not for
its range. It also records the slot's `width`, because the refusable set depends on it.
`4294967296` is unstorable in an int32 slot and stored exactly in an int64 one, so
`BitField<T>` properties read at `'int64'`, and all others at `'int32'` or `'uint32'` as
the setter's signature dictates.

The guard counts hand-rolled validators, not only those built through the DSL. A sweep
keyed on the DSL alone reads zero while a hand-rolled validator ships an invented bound.
For example, `set_visibility_aabb` assigns a negative extent unaltered, so a hand-rolled
`GPUParticles3D.visibility_aabb` validator that rejects one ships an invented bound.

**Each advisory threshold carries a `cite`.** `RangeArm.cite` is required, so the
compiler rejects an uncited arm. `rangeAdvisoryGrounding.test.ts` then checks that the
string names a source location and does not restate the rule's own opinion. Arms are the
other population outside the sweep, and the one where invented thresholds ship.

**A rule's severity is fixed by its grounding kind.** A semantic rule declares an
`EmitGrounding` per reported name, and `severityFixedBy` maps the kind to the severity.
A ported `get_configuration_warnings()` row is a **warning**. An `engine-inert` claim
(the engine reads the value and leaves it inert) is an **info**. A
`previewer-limitation` is an **info**. A `linter-failure` is an **error**. The three
scopes that describe the file, not the engine (`dangling-reference`,
`unresolvable-path`, `file-integrity`), are **warnings**. Only the `engine` kind is left
to its cite, since a refusal and a hint sit on the same kind. `emitsGrounding.test.ts`
holds each declared severity to that map, and `ruleCoverage.emits.test.ts` holds each
literal push site to the severity its rule declares.

**A bound cites each end separately when the ends differ.** `enforced` and `hinted` each
take `{ min, max }`, because a floor with an `ERR_FAIL_COND` and a ceiling with only a
hint are two different claims and must produce two different severities.

## Consequences

- A rule that only restates a preference is deleted, not widened. A rule left with no
  check loses its `linter.ts`, its test and its barrel import. A speculative rule is
  worse than none.
- The vendored corpus is the acceptance test for this ADR. It holds official Godot demo
  projects, so a diagnostic they trigger is evidence against the rule until the source
  says otherwise. Errors stay confined to the deliberate `edge-*` negative fixtures.
- Some properties are quieter than a scene author might like. That is the point. A
  warning that fires on the engine's own demos trains people to ignore warnings.
- The tests are part of the blast radius. Where a slice test disagrees with the source,
  the test is wrong, because a threshold and the test that asserts it are written from
  the same misreading.
