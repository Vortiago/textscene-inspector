# Order-sensitive Control and Range setters are resolved in file order at parse time; linter warnings name the hazard too

- Status: **Accepted** (2026-08-09) — Option B, applying the known side-effecting
  setters' semantics in file order at parse time. Accepted on the condition that
  every rule it encodes is grounded in Godot's own source and measured behaviour
  rather than in inference about what the engine probably does; the citations below
  are the record of that. Option C's advisory warnings stand alongside it, since a
  warning names the authoring hazard even where the parser now resolves it.
- Related: ADR-0037 (Control nodes render natively — `controlRectSolver.ts`,
  `controlAnchors.ts`), ADR-0001 (unified slice, React-free linter — the two-parser
  seam this ADR's options act on).

## Context

Godot applies a node's properties **in file order**, while the node is still an
orphan: `SceneState::instantiate` calls `node->set(...)` in a loop over the scene's
own property list (`scene/resources/packed_scene.cpp:491-492`) before the
`_add_child_nocheck` that parents it (`:541`). A setter with a side effect on a
sibling property therefore sees, and can overwrite, whatever was applied before it —
and file order is not declaration order, so two `.tscn` files that set the same keys
to the same values in a different sequence can produce a different final node.

**Measured against Godot 4.6.3** (not re-derived here): the same `Control`, same four
`offset_*` values, only the order changed against `anchors_preset = 15`.

| Order | Result |
| --- | --- |
| `offset_left/top/right/bottom = 40/40/240/160` written **before** `anchors_preset` | the preset's `set_offsets_preset` wipes them to `(0,0,0,0)` → rect `(0, 0, 1152, 648)` |
| The same offsets written **after** `anchors_preset` | they survive → rect `(40, 40, 1352, 768)` |

`Control::_set_anchors_layout_preset` (`scene/gui/control.cpp:982-1032`) is the
setter, and it has **three** sibling side effects, not one — it calls
`set_anchors_preset`, `set_offsets_preset`, and `set_grow_direction_preset` in turn
(`:1004`, `:1007-1029`, `:1032`), so `anchor_*` and `grow_horizontal`/`grow_vertical`
are wiped by the identical mechanism as `offset_*` when authored before the preset.
The setter is also **gated**: it returns immediately unless `layout_mode` has already
been applied as `1` (Anchors) or `3` (Uncontrolled) (`:991-1001`, reading
`data.stored_layout_mode`) — so `anchors_preset` authored before `layout_mode` does
nothing at all, silently. Four order-sensitive pairs in one setter:
`anchors_preset` vs. `offset_*` / `anchor_*` / `grow_*`, and `layout_mode` vs.
`anchors_preset`.

**This codebase already assumes one fixed order, and it is only sometimes right.**
`packages/textscene-core/src/r3f/controls/controlAnchors.ts`'s `resolveOffsets` has a
comment reading "An authored `offset_*` wins per side: the four floats are serialized
**after** `anchors_preset` (`control.cpp`'s `ADD_PROPERTY` order)" — but `ADD_PROPERTY`
order is the EDITOR's serialization order, not a constraint on what a hand-authored or
hand-edited `.tscn` may write. `resolveAnchors`/`resolveOffsets`/`resolveGrowDirection`
always resolve as if the explicit value came second (i.e. always "wins"), which matches
Godot only for the editor-saved order.

**Not currently divergent.** No scene in the corpus authors the wipe/no-op order, and
an editor-saved `Control` scene is structurally immune:
`Control::_get_anchors_layout_preset` (`control.cpp:1039-1112`) derives the preset
number **from the final anchors**, so a serialized non-zero `anchors_preset` always
co-occurs with matching `anchor_*` and a `layout_mode` written first — the editor
cannot produce the divergent order even by accident. A hand-authored or hand-edited
`.tscn` carries no such guarantee, and this codebase accepts hand-authored input as a
first-class case (the web app's Source pane, ADR-0020; uploaded files; any text
editor via the VS Code extension).

**A second class carries the identical shape: `Range`** (`HSlider`/`VSlider` in
this codebase). `Range::set_min`/`set_max`/`set_page`
(`scene/gui/range.cpp:211-226`, `:228-241`, `:254-266`) each end by calling
`set_value(shared->val)` — re-clamping the CURRENT `value` against whatever
`min`/`max`/`page` exist at that moment (`_calc_value`, `:182-200`), exactly the
"applied, then a later sibling setter runs over it" shape as `anchors_preset`.
`min_value`, `max_value`, `page` and `value` are all ordinary, independently
`.tscn`-serialized `Range` properties (`range.cpp:405,406,408,409` — no
`PROPERTY_USAGE_EDITOR`-only restriction). **This one is more reachable in
practice than the Control case**: nothing about it requires an unusual authoring
CHOICE the way Control's divergent order does (an editor never produces it) — it
only requires editing a slider's `value` line without also touching its bounds'
position, which is exactly the kind of hand-edit a `.tscn` accepts as first-class
input (Source pane, uploaded files, any text editor via the VS Code extension) and
that a corpus of hand-tuned sliders/progress bars would plausibly do. Full
derivation, including a traced-by-hand numeric example, is in the Breadth survey
below and in `hslider/linter.test.ts`. Both `Control` and `Range` are covered by
Option C, implemented in this change (see Decision).

## Enumerated cost

### Where order would be captured

`TscnParserCore.parse()` (`packages/textscene-core/src/parser/TscnParserCore.ts`)
builds each node's property bag as `currentProperties: Record<string, string>`,
assigning one key at a time in a single forward scan over the file
(`currentProperties[property.key] = property.value`, line 240; the multiline path at
line 143 does the same). **None of the TSCN grammar's property keys are numeric
strings**, so per the ECMAScript spec (`OrdinaryOwnPropertyKeys`: integer indices
first, then string keys in insertion order), `Object.keys()`/`Object.entries()` on
this object already yields exactly the file order — with zero code added at the
scanning seam.

That object is not thrown away. `NodeRegistry.ts:129` and `:148` (`parseNodeWithRegistry`,
the lenient parser's node creator) store the **same object reference** as
`TscnNode.rawProperties` on **every** node — not only instance nodes, despite the
field's doc comment ("retained so a type-less instance node's overrides can be
re-parsed") underselling it. `StrictTscnParser.ts:21-45`'s `createSimpleNode` (the
strict/linter parser's node creator) goes further: it stores that same object
directly as `TscnNode.properties` — for the strict-parser path, a node's `properties`
**is** the raw, order-preserving bag, with no typed intermediate at all.

**Conclusion: file order is not lost by the scanner or discarded by the two node
creators. It is discarded only by a consumer that reads the bag through a named key**
(`properties.anchors_preset`) instead of iterating it — which is what every
`parser.ts` in the render path does, because until now nothing needed the order.

### Consumer count

- **81** `nodes/**/parser.ts` files exist; **71** read `properties.<key>` by name
  (`grep -l "properties\." nodes/**/parser.ts`). The other 10 either take no
  properties or delegate entirely to a shared parser (e.g. `hslider/parser.ts` →
  `shared/slider.ts`).
- Of those 81, exactly **2** currently hardcode a single resolution order for a
  known Godot setter-with-a-sibling-side-effect: `r3f/controls/controlAnchors.ts`
  (`resolveAnchors`/`resolveOffsets`/`resolveGrowDirection` — three functions, one
  file, the Control family) and `nodes/2d/ui/shared/range.ts`'s `rangeRatio` (the
  Range/Slider family — see Breadth survey below, found independently while costing
  this). The other 69 read properties that do not interact with each other in
  Godot, so a named-key read is simply correct for them; they are unaffected by any
  option below.
- **69** `linterParser.ts` files exist, covering every registered validator. **All
  69** do nothing but `validatorRegistry.registerAll('Type', { key: v.xxx(...) })` —
  none re-parses the raw bag into a typed shape (confirmed:
  `grep -L registerAll nodes/**/linterParser.ts` is empty). They validate one key's
  own format in isolation and never compare two keys, so **none are affected by any
  option** below.
- `Linter.ts`'s Phase 2 (`RuleContext.node.properties`, fed from `StrictTscnParser`)
  is, per the previous section, already the raw ordered bag. **A new semantic rule
  can read `Object.keys(node.properties)` for file order with zero parser change** —
  this is what Option C (below) does.

### The apps

`grep -rn "\.properties\b|rawProperties" apps/textscene-web/src apps/textscene-vscode/src apps/textscene-linter/src`
returns **zero matches** in all three. Every app consumes `@textscene/core` through
its public surface (`SceneGraph`, the parser/linter entry points, `useResource`, …),
never `TscnNode.properties`/`rawProperties` directly. **A change to how properties are
represented on `TscnNode`, additive or not, is not source-breaking for any of the
three apps** — it is entirely contained inside `@textscene/core`.

### Two wrinkles that any order-consuming option must answer

1. **Duplicate keys collapse to their first position.** Re-assigning an existing
   plain-object key does not move its enumeration order — only ADDING a new key
   appends it. A `.tscn` that writes `offset_left` once before `anchors_preset` and
   again after it reports as "before" under `Object.keys()`, even though Godot
   applies **both** assignments, in order, and the second (post-preset) one really
   does survive. A `Record<string,string>` cannot represent "this key was written
   twice" at all — this is the one case where only explicit ordered storage
   (`PropertyEntry[]`/similar, Option A done as a real data-shape change) is
   faithful; Option B, reading `Object.keys()`, is not.
2. **`mergeInstanceRoot.ts:80-83`'s raw merge does not produce either file's
   order.** `{ ...root.rawProperties, ...instanceNode.rawProperties }` keeps a
   shared key at **root's** enumeration position (object spread does not reposition
   an already-present key) while taking the **instance's** value, and appends any
   instance-only key after every one of root's keys — a hybrid that is neither the
   root scene's file order nor the instance scene's. Any order-consuming resolution
   (Option A or B) is wrong here unless this merge path is special-cased; today
   nothing reads order, so this is latent, not yet a bug.

### The linter side (`StrictTscnParser` / `RuleRegistry` / `ValidatorRegistry`)

No change is forced by Option B. `ValidatorRegistry`'s per-property format
validators (Phase 1) never compare two keys and are untouched by any option.
`RuleRegistry`'s semantic rules (Phase 2) already receive the raw ordered bag as
`node.properties` (see above) — Option C, implemented in this change, is three
ordinary `LintRule`s (`control-property-order`, `hslider-property-order`,
`vslider-property-order`) reading that order; no `ParseObserver`/`StrictTscnParser`
change was needed for either family.

## Breadth survey — how wide is this class of bug?

Two node families are **confirmed** reachable-from-`.tscn` instances, in different
Godot classes, both covered by Option C (Decision, below):

- **`Control`** (the measured finding in Context): `anchors_preset` vs.
  `offset_*`/`anchor_*`/`grow_*`, and `layout_mode` vs. `anchors_preset`. Currently
  latent — no scene in the corpus authors the divergent order, and an editor-saved
  scene cannot produce it at all.
- **`Range`** (`HSlider`/`VSlider` in this codebase — see Context for the
  mechanism). Also currently latent in THIS corpus specifically: the fixture files
  (`unit-hslider.tscn`, `unit-vslider.tscn`, `complex-2d-gui.tscn`) always author
  `min_value`/`max_value` before `value`. Traced by hand against the struct
  defaults (`min=0.0`, `max=100.0`, `page=0.0` — `range.h:39-43`): a `.tscn` that
  writes `value = 150` BEFORE `min_value = 0` / `max_value = 200` clamps `value`
  against the still-default `max = 100` the instant `value`'s own setter runs
  (`!allow_greater && 150 > 100-0` → clamps to `100`, `_calc_value`,
  `range.cpp:182-200`), and the later `min_value`/`max_value` lines only re-clamp
  the ALREADY-corrupted `100` — they never recover the authored `150`. The same
  three lines in the editor's own order land at the correct `150`. For contrast,
  `Node3D`'s decomposed `position`/`rotation`/`scale` carry `PROPERTY_USAGE_EDITOR`
  only (`scene/3d/node_3d.cpp:1526-1531`) — no `STORAGE` flag — and so are in fact
  **never** serialized to a `.tscn` at all (confirmed by grep: 0 hits for
  `^position = Vector3` against 135 hits for `^transform = Transform3D` across the
  fixture corpus); `Range`'s four properties carry no such restriction
  (`range.cpp:405,406,408,409`), which is what makes this instance real.
- **A fifth Control pair**, found while costing this and not in the original
  four: `Control::_set_layout_mode` (`control.cpp:919-935`), when applied with
  `p_mode == LAYOUT_MODE_POSITION` (`0`, the struct default), unconditionally calls
  `set_anchors_and_offsets_preset(PRESET_TOP_LEFT, KEEP_SIZE)` and
  `set_grow_direction_preset(PRESET_TOP_LEFT)` (`:927-930`) — so an explicitly
  authored `layout_mode = 0` wipes any `anchor_*`/`offset_*`/`grow_*` written before
  it, the same mechanism as `anchors_preset`, just via the OTHER property. Rare in
  practice (`0` is the default, so the editor does not normally serialize it), but a
  hand-edited file is not bound by what the editor normally does.

**Size of the class, estimated mechanically, not enumerated.** A syntactic grep over
the Godot 4.6.3 source (`scene/gui/`, `scene/2d/`, `scene/3d/`, `scene/main/` — the
directories holding the `Node` subclasses a `.tscn` can actually declare) for
`ClassName::set_foo(...) { … }` definitions whose body calls a **different**
`set_*`/`_set_*` method: **2,411** setter definitions scanned, **348** (≈14%) call a
sibling setter, spanning **107** distinct classes — among them several this codebase
already implements: `CollisionShape3D`, `MeshInstance3D`, `AnimatedSprite2D`/`3D`,
`GPUParticles2D`/`3D`, `CPUParticles2D`/`3D`, `Camera2D`, `CollisionObject2D`/`3D`,
`NavigationRegion*`. **This raw count is a size signal, not a reachability list**:
most hits are internal C++ convenience methods with no `ADD_PROPERTY` binding at all
(`set_collision_layer_value` is a bitmask helper callable from script, not a `.tscn`
property line; several `VisualShaderNode*` hits are graph-internal, gated behind
`[sub_resource]` blocks most scenes never hand-edit) and were not individually
checked for `.tscn` reachability the way `Control` and `Range` were. Read as: **this
is not a two-pair problem**, but confirming each hit's real-world reachability was
out of scope for a costing pass — the two confirmed examples above are the load-bearing
evidence, the count is the order-of-magnitude context.

One structural note: `[sub_resource]` blocks parse through the exact same
`TscnParserCore` scanning loop and get the exact same order-preserving raw bag
(`parseInternalResource`), so a resource with a setter-with-side-effects
(`ParticleProcessMaterial::set_param_min`/`set_param_max`,
`BaseMaterial3D::set_on_top_of_alpha`, `Theme::set_theme_item`, …) is exposed to the
identical class of bug for a hand-edited `.tres`/inline resource — out of scope for
this ADR (it only covers `TscnNode` — node property blocks, `Control` and `Range`
today), but the same reasoning and the same `linter/propertyOrder.ts` helper apply
if this is revisited for resources.

## Considered options

**(a) Retain full per-node property order in the parse tree**, as a real data-shape
change (e.g. `TscnNode.rawProperties` typed as ordered entries rather than a plain
`Record`, or a `Map`). *Cost:* the scanning seam needs nothing new (order is already
captured); the change is confined to `@textscene/core`, not the three apps (confirmed
above); it correctly handles the duplicate-key wrinkle Option B cannot. *Failure
mode:* solves a problem Option B already solves for every case this corpus or this
finding actually exercises, at the cost of a type migration through
`rawProperties`'s few consumers (`mergeInstanceRoot.ts`, `viewportContent.ts`) for a
benefit (duplicate-key fidelity) with no known instance in the wild. Rejected as
disproportionate **given the "already latent" finding above** — the premise that this
"touches the shape of the parsed node" turned out to be false for storage; only
Option A's marginal value over B (duplicate keys) would require it, and that value is
theoretical today.

**(b) Do not add new storage; special-case the known side-effecting setters at parse
time**, applying Godot's own setter semantics in file order for just those keys
(`resolveAnchors`/`resolveOffsets`/`resolveGrowDirection` in `controlAnchors.ts`
become order-aware — read `rawProperties`' key order once, decide per-side whether
the authored value or the preset's derived value is the one that survives — plus the
equivalent for `rangeRatio()` in `shared/range.ts`, the same two families Option C
now covers on the linter side). *Cost:* small and
localized — three functions in one file for Control, one function in one file for
Range, both already the SOLE order-assuming consumers found. `rawProperties` already
carries the order (no scanner change); the render parser's typed `ControlProperties`
shape does not need to change, only how the two known-affected resolvers read the raw
bag alongside it. *Failure mode:* the mergeInstanceRoot wrinkle (above) must be
handled explicitly (its raw merge produces neither file's order) or the resolvers
must fall back to the current fixed-order behavior when a node came through that
path; the duplicate-key wrinkle is unhandled (accepted, since Option A's own cost
argument shows it is not required for what this corpus needs). Extending this to a
NEW side-effecting family found later (the breadth survey shows there could be more)
costs one more localized special case each time, not a re-architecture. **This is the
option this ADR recommends** (see Decision).

**(c) Do nothing structural; add a linter rule that warns when a scene authors a
known order-sensitive pair in the divergent order — for EVERY family this ADR
confirms, not just the one first measured.** *Cost:* genuinely small —
`RuleRegistry`'s Phase 2 already hands a rule the raw ordered bag as
`node.properties`. **Implemented in this change** for both `Control` and `Range`
(see Decision) — three registered rules (`control-property-order`,
`hslider-property-order`, `vslider-property-order`), sharing one ~60-line pure
helper, `linter/propertyOrder.ts`'s `targetsBeforeLatestTrigger` (which target keys
sit before the latest-positioned trigger key that is actually present), because
BOTH families reduce to the identical shape: N "target" properties silently
overwritten by whichever of M "trigger" properties runs latest. Deliberately NOT
generalized further than that one function into a rule-authoring framework (a
declarative "hazard spec" registry, a factory that builds and registers a
`LintRule` from a target/trigger list) — two families sharing one arithmetic
function is proportionate; a framework is not justified by two data points, and
the breadth survey's 348-setter count is a size ESTIMATE, not a list of families
ready to be declared. Each family keeps its own file(s), its own rule name(s), and
its own message wording, because the shapes still differ in what they say: Control
additionally carries an operability GATE (`layout_mode` vs. `anchors_preset`, no
Range equivalent) that stays bespoke rather than folding into the shared helper,
and `HSlider`/`VSlider` register two separately-named rules rather than one shared
name because `Range` has no entry in `NODE_BASE_TYPES` to hang a single
`applicableNodeTypeMatcher` off (`CONTROL_LEAVES`' own comment: "neither
intermediate is authorable" — the same reason the format validators link straight
to `Control` instead of through a `Range`/`Slider` link). *Failure mode, stated
plainly:* a warning does not make the renderer correct. The previewer still paints
the wrong rect/value for a scene that authors either family's divergent order —
against this project's own "the preview shows what Godot shows" decision (ADR-0037's
plan-level framing) — until Option B (or A) is separately implemented. A linter rule
is a mitigation for AUTHORING new scenes correctly, not a fix for rendering an
already-divergent one. It is not a substitute for Option B; it is a complement that
is cheap enough to ship in the same change regardless of which of A/B/D is decided
for the render side.

**(d) Do nothing; record as a parity limitation.** *Cost:* zero engineering.
*Failure mode:* the renderer stays silently wrong for any hand-authored scene that
happens to hit this order (which this project cannot control, since it accepts
uploaded/pasted/hand-edited `.tscn` as first-class input — Source pane, VS Code
extension, file upload), with no signal to the scene's author that anything is
wrong. Given the corpus shows no *known* current divergence, this differs from (c)
only in that (c) would at least have caught the NEXT one before it shipped. Rejected:
"nothing has hit this yet" is not evidence nothing will, and a silent, unflagged
correctness gap is worse than a flagged one at effectively the same engineering cost
as choosing not to add the handful of small rule files this ADR did add.

This project is pre-1.0 with no back-compat obligations (no existing-user/developer
guarantees to preserve), so "Option A/B would be a breaking change" is not, by
itself, an argument against them — none of the three options changes any public
`@textscene/core` export the apps consume (confirmed: zero `.properties`/
`rawProperties` references in any app).

## Decision

**Option B is implemented, for both confirmed families.** It was proportionate to
what this finding and the breadth survey actually demonstrated (two confirmed
families, a handful of functions, no new storage), and Option A's only real
advantage over it — duplicate-key fidelity — has no known instance to justify
carrying a type migration for.

`r3f/controls/controlAnchors.ts`'s `resolveControlLayout` REPLAYS a Control's raw
`.tscn` property keys in file order — a direct simulation of
`Control::_set_layout_mode`/`_set_anchors_layout_preset`'s setters (tracking
`stored_layout_mode`, `anchor[4]`, `offset[4]`, `h_grow`/`v_grow` exactly the way
`Control::Data` does) rather than a pairwise "does X come before Y" rule, so it
covers all FIVE order-sensitive pairs the breadth survey named — including
`layout_mode = 0`'s own unconditional reset (`control.cpp:919-935,927-930`), found
while costing this and not one of the original four — without growing pairwise
special cases. `nodes/2d/ui/shared/range.ts`'s `resolveRangeValue` does the
equivalent for `Range`, replaying `min_value`/`max_value`/`page`/`value` against
`Range::set_min`/`set_max`/`set_page`/`set_value` (`range.cpp:211-266`), including
the refinement the initial costing understated: `set_min`/`set_max` also mutually
constrain each other (`shared->max = MAX(shared->max, shared->min)`,
`max_validated = MAX(p_max, shared->min)`) and both clamp `page`
(`shared->page = CLAMP(shared->page, 0, shared->max - shared->min)`), so `page` is
part of the replay and `min`/`max`/`page` interact with each other, not only with
`value`. `set_step` was checked and confirmed inert as a TRIGGER (no `set_value`
call of its own, `range.cpp:243-252`) and is excluded from the replay; `Range`'s
`p_step > 0` snap term inside `_calc_value` (`range.cpp:184-186`) is a separate,
pre-existing rendering-fidelity gap `rangeRatio` never modelled even before this
change, and stays out of scope here to avoid conflating an order fix with a new
feature.

Both resolvers take the raw ordered keys as an explicit, OPTIONAL parameter
(`ControlLayoutOrder`/`RangeValueOrder`, both `readonly string[] | undefined`) and
fall back to the pre-existing fixed-order resolvers/`rangeRatio` behaviour —
editor-save order — whenever that order is absent or unreliable. `TscnNode` grew
one additive field, `rawPropertiesOrderReliable?: boolean`, to carry that fact:
`core/NodeRegistry.ts`'s `parseNodeWithRegistry` sets it `true` for every node it
builds (one `TscnParserCore` scan, real file order), and
`resources/mergeInstanceRoot.ts` sets it explicitly `false` on a merged instance
root — its raw merge (`{ ...root.rawProperties, ...instanceNode.rawProperties }`)
keeps a shared key at ROOT's position with the INSTANCE's value, which is neither
file's real order, so a merged node takes the fixed-order (editor-save) path
exactly as it did before this change. `native/solveTree.ts`'s `controlLayoutOrder(n)`
is the one place a `SolveNode` consumer reads that fact, shared by
`native/controlRectSolver.ts` (Control) and both `HSlider`/`VSlider`
`Component.tsx`s (Range) rather than each re-deriving the reliability check.

**Not modelled, both cited in `resolveControlLayout`'s own doc rather than left
silent:** `Control::set_anchor`'s `p_push_opposite_anchor` clamp
(`control.cpp:758-786`, default `true`) — a genuinely order-sensitive mechanism
found while reading the source for this change, but a DIFFERENT shape (incremental
per-edge state, not a "later trigger wipes an earlier target" pair) than the five
pairs this ADR's breadth survey grounds, and out of scope for this change.

**The duplicate-key wrinkle (Considered options, above) remains unaddressed**,
exactly as this ADR always said Option B would leave it: a `Record<string, string>`
still cannot represent "this key was written twice", so a `.tscn` that assigns the
same order-sensitive key more than once is read at its FIRST position with its
LAST value — Option A's own advantage, still without a known instance to justify it.

**Option C stays in place, for every family this ADR confirms** — `Control`
(`control-property-order`) and `Range` (`hslider-property-order`,
`vslider-property-order`) — as a complement, not a superseded interim measure: a
warning names an authoring hazard a human maintaining the file should still see,
even now that the parser resolves it correctly (`control/linter.ts`'s module doc
says so explicitly). The three rules still share one pure order-comparison function
(`linter/propertyOrder.ts`) rather than duplicating the arithmetic per family, and
still stop short of a rule-authoring framework.

## Consequences

- **The renderer resolves both families' file order correctly.** A scene that
  authors either divergent order — Control's `anchor_*`/`offset_*`/`grow_*`/
  `layout_mode` vs. `anchors_preset`, or `layout_mode = 0`'s own reset, or Range's
  `value` vs. `min_value`/`max_value`/`page` — now previews the SAME rect/value real
  Godot 4.6.3 would produce for that exact file order, not a fixed assumption. The
  acceptance case this ADR was accepted against (the same four `offset_*` values,
  only the order against `anchors_preset = 15` changed) resolves to `(0, 0, 1152,
  648)` when the offsets precede the preset and `(40, 40, 1352, 768)` when they
  follow it — both, in the same build.
- **`pnpm lint:tscn`/the VS Code extension's diagnostics/the web app's Source-pane
  gutter still warn** — all severity `warning`, an advisory condition, not an error,
  per this project's linter conventions — for:
  - a Control-family node (`control-property-order`) that authors
    `anchor_*`/`offset_*`/`grow_*` before an operational `anchors_preset`, or
    `layout_mode` after one;
  - an `HSlider`/`VSlider` (`hslider-property-order`/`vslider-property-order`) that
    authors `value` before any of `min_value`/`max_value`/`page` that runs after it.

  The corpus's existing fixtures are all editor-order (Control) or bounds-before-value
  order (Range) and stay silent for both rules (confirmed: `fixtureLint.test.ts`,
  `ruleCoverage.test.ts`, `barrelCompleteness.test.ts` pass with the three rules
  registered) — a grep of the full `scenes/` corpus (fixtures and demos) for every
  order this change makes behave differently (the divergent Control order, the
  divergent Range order, a per-edge `anchor_*` default, `page`/`allow_greater`/
  `allow_lesser`/`rounded` on any Range-family node, and `layout_mode = 0` authored
  after an anchor/offset/grow key) found zero matches, confirming no visual golden
  needed to move for this change.
- If a THIRD order-sensitive family turns up (the breadth survey's 348-setter count
  suggests more are plausible), the same shape of fix applies on both sides: the new
  family's own resolver reads `rawProperties`'/`node.properties`' key order once
  (mirroring `resolveControlLayout`/`resolveRangeValue`), and Option C's linter side
  reuses `targetsBeforeLatestTrigger` from a new small rule file, the same way
  `Range`'s did. Nothing here forecloses either.

## Known limitations of the implemented Option C

- **The Control rule inherits a pre-existing base-type gap.** It reaches the Control
  family through `NODE_BASE_TYPES` (`linter/nodeBaseTypes.ts`), the same table
  `ValidatorRegistry`'s existing format-validator inheritance uses. That table's
  `CONTROL_LEAVES` list does **not** include `HSplitContainer`/`VSplitContainer` — a
  pre-existing gap (those two types inherit no Control validators of any kind today,
  format or semantic), unrelated to this ADR's finding. `control-property-order`
  inherits that gap rather than fixing it: fixing `CONTROL_LEAVES` is a separate,
  general change (it would also affect every existing format validator, not just
  this rule) and was left alone to keep this change's footprint to exactly the
  property-order finding. The Range rules have no equivalent gap — `HSlider` and
  `VSlider` are named directly (`applicableNodeTypes`), since `Range` has no
  `NODE_BASE_TYPES` entry to matcher against in the first place.
- **Neither rule simulates Godot's actual clamp/overwrite math.** Both flag every
  "target before its (latest) trigger" ordering, whether or not the specific values
  involved would end up differing once the trigger runs (e.g. an authored `value`
  that happens to already fit inside the stale default range triggers the same
  warning as one that doesn't) — deliberate, matching the "authoring hazard, not a
  render simulation" framing in Context, and cheaper than re-deriving each setter's
  full arithmetic in the linter.
