# Diagnostics are grounded in the engine source, never in the class reference

- Status: Accepted (2026-08-03)
- Related: ADR-0001 (two parsers, one scanning loop), `linter/rangeAdvisory.ts`,
  `linter/validators/v.ts`.

## Context

The linter accumulated a family of magnitude thresholds written from intuition or
from a sentence in Godot's class reference, under names like
`EXTREME_LIGHT_ENERGY_MAX`, `LARGE_OMNI_RANGE` and `MIN_RECOMMENDED_TRAVEL`. None
cited a source line, and several were narrower than what the engine itself accepts.

They were measurably wrong, not merely unproven. `VehicleWheel3D.suspension_travel`
was bounded to `0.1-0.3` because `doc/classes/VehicleWheel3D.xml` says "Try a value
between 0.1 and 0.3 depending on the type of car." The `.cpp` binds that property
`PROPERTY_HINT_NONE` and `set_suspension_travel` assigns without a clamp, so the
engine states no range at all — and Godot's own `truck_town` demo, the canonical
VehicleBody3D example, ships `2.0` on all eight of its wheels. The advisory fired
eight times out of eight on the reference implementation of the node it was
policing, and the slice's own test had encoded the wrong band, asserting a warning
for exactly the value the demo uses.

`spot_attenuation` and `omni_attenuation` were bounded `0.1-5` while the engine hints
`"-10,10,…,or_greater,or_less"`. Across the vendored corpus, roughly 25 of 136
warnings came from thresholds of this kind firing on official Godot demo projects.

A separate error was made while correcting this: hint bounds were briefly treated as
grounds for an ERROR. They are not. A `PROPERTY_HINT_RANGE` constrains the editor's
inspector widget; a `.tscn` carrying a value outside it still loads and runs.
`set_volume_db` only `ERR_FAIL`s on NaN, and `Light3D::set_param`'s `ERR_FAIL_INDEX`
guards the parameter INDEX rather than the value — both read like enforcement and
enforce nothing.

## Decision

A slice's property lands in exactly one of three tiers, decided by the engine
source: **error**, **warning** or **nothing**. The fourth row below is not one of
them and must not be declared on a property — it is the shared post-pass that
runs over every int slot, described under "A binding-layer conversion" below.

| Tier | Grounding | Verdict |
| --- | --- | --- |
| **error** | The setter refuses or alters the value: an `ERR_FAIL*`, or a clamp/mask that silently changes what was written. | error |
| **warning** | The value lies outside what the property's own UI-control hint permits: `PROPERTY_HINT_RANGE`, `PROPERTY_HINT_LAYERS_*` or `PROPERTY_HINT_FLAGS` in its `ADD_PROPERTY`. | warning |
| **nothing** | `PROPERTY_HINT_NONE`, no hint, both hint ends open, or a bound that exists only in the class-reference prose. | no rule |
| **conversion** — shared, never declared by a slice | The Variant binding narrows the literal on the way IN, so the setter never sees what was written: `_to_int` truncating `5.5` to 5 (`variant.h:369-370`). | warning |

The rules that decide which row a property lands in:

- **`,or_greater` opens the MAX end and `,or_less` opens the MIN end.** An open end
  can never produce a diagnostic. Both open means the property gets none at all.
- **The hint is source, not prose.** It lives in the `.cpp` and states what the
  editor UI permits, which is reliable enough to warn on. The class reference's
  narrative advice is not, and never grounds a diagnostic on its own.
- **A hint is not enforcement.** It yields a warning, never an error. Only the
  setter's own behaviour can justify an error.
- **A binding-layer conversion is not the setter's behaviour either.** `_to_int`
  runs BEFORE the setter, which receives the already-narrowed int: `set_hframes`
  only ever sees the 5 that `hframes = 5.5` became. Measured on 4.6.3, that file
  loads and stores 5 with no engine complaint. The stored value still differs
  from the written one, so it is worth reporting — as a warning, because the
  error row is reserved for what the setter itself does. This applies to EVERY
  int slot, so it belongs to the shared `storedNotWritten`
  (`linter/validators/intSlot.ts`) rather than to any
  property: three combinators used to call it a FORMAT error on 56 of 225 slots
  while the rest were silent, and the same `.cpp` line judged `Sprite2D.hframes`
  and `Sprite3D.hframes` differently. It is checked after every bound, so a
  value that is both fractional and out of range reports the error.
- **A bit mask is two tiers, not one.** Where a setter stores `p_flags & MASK`, a
  bit outside the mask is DROPPED, which is the error row's "silently changes what
  was written"; a bit inside the mask but absent from the `PROPERTY_HINT_FLAGS`
  list is kept unaltered and only unreachable from the inspector, which is the
  warning row. `autowrap_trim_flags` is both at once: the mask keeps 224, the hint
  offers 192. Membership is not a range, so neither tier can be expressed as a
  min/max bound; `maskedBitField` exists for this shape.

Every surviving threshold carries the governing `file:line` in a comment beside it.
A constant named for a feeling rather than a source — `EXTREME_*`, `LARGE_*`,
`SMALL_*`, `*_RECOMMENDED` — does not pass review without that citation.

### File scope is declared, not grounded

`legacy-format-version` cites no engine rule, because there is none to cite. The
text loader compares the header's format version in exactly three places and
every one is `>`: `if (format_version > FORMAT_VERSION)` refuses a file as
`ERR_FILE_UNRECOGNIZED` (`resource_format_text.cpp:1141`, `:1331`, `:1369`).
There is no less-than comparison anywhere in that file, no `DISABLE_DEPRECATED`
branch in it, and the Variant parser's tolerance for Godot-3 spellings
(`PoolByteArray`, `variant_parser.cpp:1410`) is not gated on the version either.
Godot 4.6.3 opens a `format=2` file and parses it with the current grammar.

The linter declines it regardless, and that is a decision about this tool's
scope rather than a report about the engine. Version 3 gave ext/subresources
their string ids — "Version 3: New string ID for ext/subresources, breaks
forward compat." (`resource_format_text.h:44`) — so on a `format=2` file the
reference rules read integer ids as dangling and every bound is judged against a
grammar the file predates. Those diagnostics would be WRONG, not merely noisy,
which is why the file gets one info and nothing else.

Two consequences, both load-bearing:

- **It informs, never errors.** The file loads, and the claim is about this tool's
  scope rather than about the engine — a `previewer-limitation`, which
  `severityFixedBy` fixes at **info**. An error would misstate the engine and would
  fail `lint:scenes` on content Godot accepts.
- **The current end is deliberately unbounded.** `FORMAT_VERSION = 4`
  (`resource_format_text.h:46`) is the accepted ceiling and
  `FORMAT_VERSION_COMPAT = 3` (`:48`) the saver's default; ONE 4.6.3 saver
  writes both, choosing per file on whether a `PackedVector4Array` or a
  >64-byte `PackedByteArray` is present (`resource_format_text.cpp:1724-1732`,
  `:1770`, `:1798`). Neither is legacy — the vendored Godot demo projects
  (`scenes/demos`, `scenes/isometric`) ship both spellings side by side, and
  4.6.3 opens either. A header declaring no format is current
  too (`} else { format_version = FORMAT_VERSION; }`, `:1147-1148`). A ceiling
  check would begin firing on legitimately-current files the moment a later
  engine raises `FORMAT_VERSION`, so there is none.

### Usage flags decide whether there is anything to ground at all

Before asking which tier a property belongs to, ask whether it reaches a `.tscn`
at all. `_validate_property` and the usage flags answer that, and they get read
wrong in both directions — as a removal that is not one, and as a hiding that is
not one. Three rules, because a property that never serialises needs no validator
while one that does must not be reported as impossible:

- **`PROPERTY_USAGE_NONE` removes storage.** The property is never written, so it
  gets no validator. That alone is NOT `registerUnavailable`: modelling a key as
  removed means claiming a scene carrying it is wrong, and only a SETTER guard
  that refuses the write supports that claim. `SpinBox.exp_edit` and
  `FileDialog.dialog_text` are the cases where both hold.
- **`usage ^= PROPERTY_USAGE_STORAGE` can ADD storage back.** The XOR is a
  toggle, not a clear, so a property that reads as hidden in one configuration
  serialises in another. A key Godot writes in that mode must not be reported.
- **`PROPERTY_USAGE_NO_EDITOR` IS `PROPERTY_USAGE_STORAGE`** (`object.h:132`), so
  it serialises. It hides a property from the inspector and does nothing else;
  `SpringBoneCollision3D.bone` and the `settings/<i>/…` bone indices carry it and
  are validated.

No guard can hold this one. Verifying a usage-flag reading means reading engine
source at test time, which `scripts/godot-source-decoupling.test.mjs` forbids, so
it is written here instead — after being rediscovered from scratch once it had
already been settled. `SpringBoneSimulator3D` derived the XOR rule independently
and reached the OPPOSITE verdict from `ChainIK3D` on same-looking keys, while the
rule sat in a registry method's docblock where no slice author was looking.

## How it is enforced

A convention decays; the guards below hold. Each closes one way a diagnostic can
reject a value with nothing behind it.

**Every validator declares which kind it is.** A `PropertyValidator` carries one of
three tags: `formatOnly` (it rejects only values that never reach the property —
text the tokenizer refuses, or a type `can_convert_strict` (`variant.cpp:536-830`)
will not convert into the slot, which `PackedScene` then drops silently at
`packed_scene.cpp:492`,
so no citation is possible or needed), `grounding` (it rejects a real value, and
says which `file:line` says so), or `intSlot` (it reads an INT slot, where the
authority is the conversion itself and the citation is therefore always
`variant.h:360-377`). The `v` DSL sets one by construction: each combinator is
either a `shape(…)` or takes a `Grounding`, and `markIntSlot` adds the third. A
hand-rolled validator carries none until its author chooses, and
`boundGrounding.test.ts` fails on it.

`intSlot` is a classification only for a validator with no bounds of its own —
otherwise a bounded combinator would inherit a citation that vouches for a type
conversion rather than for its range. It also records the slot's `width`, because
the refusable set depends on it: `4294967296` is unstorable in an int32 slot and
stored exactly in an int64 one, so `BitField<T>` properties read at `'int64'` and
everything else at `'int32'` or `'uint32'` as the setter's signature dictates.

That distinction is what the first version of this ADR missed. `bounded` was set by
`ground()`, so the un-audited count only ever saw validators already inside the DSL.
It read zero while `GPUParticles3D.visibility_aabb` rejected a negative extent that
`set_visibility_aabb` assigns unaltered — the validator was hand-rolled, so it was
never in the denominator.

**Every advisory threshold carries a `cite`.** `RangeArm.cite` is required, so the
compiler rejects an uncited arm; `rangeAdvisoryGrounding.test.ts` then checks the
string names a source location rather than restating the rule's own opinion. Arms
were the other population outside the sweep, and the one where invented thresholds
had shipped.

**A rule's severity is fixed by its grounding kind.** A semantic rule declares an
`EmitGrounding` per reported name, and `severityFixedBy` maps the kind to the
tier: a ported `get_configuration_warnings()` row is a **warning**, an
`engine-inert` claim (the engine reads the value and leaves it inert) is an
**info**, a `previewer-limitation` is an **info**, a `linter-failure` is an
**error**, the three scopes that describe the FILE rather than the engine —
`dangling-reference`, `unresolvable-path`, `file-integrity` — are **warnings**,
and only an `engine` arm is left to its cite, since a refusal and a hint sit on
the same kind. `emitsGrounding.test.ts` holds every declared severity to that map,
and `ruleCoverage.emits.test.ts` holds every literal push site to the severity
its rule declares.

**A bound cites each end separately when the ends differ.** `enforced` and `hinted`
each take `{ min, max }`, because a floor with an `ERR_FAIL_COND` and a ceiling with
only a hint are two different claims and must produce two different severities.

## Consequences

- Rules that only restated a preference are deleted rather than widened. A rule left
  with no check at all loses its `linter.ts`, its test and its barrel import: a
  speculative rule is worse than none.
- The vendored corpus is the acceptance test for this ADR. These are official Godot
  demo projects, so a diagnostic they trigger is evidence against the rule until the
  source says otherwise. Errors stay confined to the deliberate `edge-*` negative
  fixtures.
- Some properties become quieter than a scene author might like. That is the point:
  a warning that fires on the engine's own demos trains people to ignore warnings.
- The tests are part of the blast radius. Where a slice test disagrees with the
  source it is the test that is wrong, because a threshold and the test asserting it
  are written from the same misreading — five separate tests had already locked in
  bounds this repo later found to be wrong.
