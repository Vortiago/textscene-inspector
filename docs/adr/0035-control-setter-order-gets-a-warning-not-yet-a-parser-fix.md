# Order-sensitive Control and Range setters are resolved in file order at parse time; linter warnings name the hazard too

- Status: **Accepted**: Option B, which applies the known side-effecting setters'
  semantics in file order at parse time. Each rule it encodes is grounded in Godot's own
  source and measured behaviour, not in inference, and the citations below are the
  record. Option C's advisory warnings stand beside it, because a warning names the
  authoring hazard even where the parser resolves it.
- Related: ADR-0037 (Control nodes render natively: `controlRectSolver.ts`,
  `controlAnchors.ts`), ADR-0001 (unified slice, React-free linter: the two-parser seam
  this ADR's options act on).

## Context

Godot applies a node's properties **in file order**, while the node is still an orphan:
`SceneState::instantiate` calls `node->set(...)` in a loop over the scene's own property
list (`scene/resources/packed_scene.cpp:491-492`) before the `_add_child_nocheck` that
parents it (`:541`). A setter with a side effect on a sibling property therefore sees,
and can overwrite, whatever was applied before it. File order is not declaration order,
so two `.tscn` files that set the same keys to the same values in a different sequence
can produce a different final node.

**Measured against Godot 4.6.3**: the same `Control`, the same four `offset_*` values,
only the order changed against `anchors_preset = 15`.

| Order | Result |
| --- | --- |
| `offset_left/top/right/bottom = 40/40/240/160` written **before** `anchors_preset` | the preset's `set_offsets_preset` wipes them to `(0,0,0,0)` → rect `(0, 0, 1152, 648)` |
| The same offsets written **after** `anchors_preset` | they survive → rect `(40, 40, 1352, 768)` |

`Control::_set_anchors_layout_preset` (`scene/gui/control.cpp:982-1032`) is the setter,
and it has **three** sibling side effects: it calls `set_anchors_preset`,
`set_offsets_preset` and `set_grow_direction_preset` in turn (`:1004`, `:1007-1029`,
`:1032`). So `anchor_*` and `grow_horizontal`/`grow_vertical` are wiped by the same
mechanism as `offset_*` when authored before the preset. The setter is also **gated**:
it returns at once unless `layout_mode` is already applied as `1` (Anchors) or `3`
(Uncontrolled) (`:991-1001`, reading `data.stored_layout_mode`). So an `anchors_preset`
authored before `layout_mode` does nothing, silently. That is four order-sensitive pairs
in one setter: `anchors_preset` versus `offset_*` / `anchor_*` / `grow_*`, and
`layout_mode` versus `anchors_preset`.

A resolver that always lets the explicit value win matches Godot only for the editor's
serialisation order. `ADD_PROPERTY` order (`control.cpp`'s) is the editor's
serialisation order, not a constraint on what a hand-authored or hand-edited `.tscn` may
write.

An editor-saved `Control` scene is immune: `Control::_get_anchors_layout_preset`
(`control.cpp:1039-1112`) derives the preset number **from the final anchors**, so a
serialised non-zero `anchors_preset` always comes with matching `anchor_*` and a
`layout_mode` written first. A hand-authored or hand-edited `.tscn` has no such
guarantee, and this codebase accepts hand-authored input as a first-class case (the web
app's Source pane, ADR-0020; uploaded files; any text editor through the VS Code
extension).

### Breadth survey

**A fifth Control pair**: `Control::_set_layout_mode` (`control.cpp:919-935`), applied
with `p_mode == LAYOUT_MODE_POSITION` (`0`, the struct default), unconditionally calls
`set_anchors_and_offsets_preset(PRESET_TOP_LEFT, KEEP_SIZE)` and
`set_grow_direction_preset(PRESET_TOP_LEFT)` (`:927-930`). An explicit `layout_mode = 0`
therefore wipes each `anchor_*`/`offset_*`/`grow_*` written before it. The editor does
not normally serialise the default `0`, but a hand-edited file is not bound by that.

**`Range` (`HSlider`/`VSlider` here) has the same shape, and is easier to reach.**
`Range::set_min`/`set_max`/`set_page` (`scene/gui/range.cpp:211-226`, `:228-241`,
`:254-266`) each end with `set_value(shared->val)`, which re-clamps the current `value`
against the `min`/`max`/`page` that exist at that moment (`_calc_value`, `:182-200`).
`min_value`, `max_value`, `page` and `value` are ordinary, independently serialised
`Range` properties (`range.cpp:405,406,408,409`, no `PROPERTY_USAGE_EDITOR`-only
restriction). Reaching it needs no unusual authoring choice, only an edit to a slider's
`value` line without a move of its bounds. From the struct defaults (`min=0.0`,
`max=100.0`, `page=0.0`, `range.h:39-43`): a `.tscn` that writes `value = 150` before
`min_value = 0` / `max_value = 200` clamps `value` against the default `max = 100` when
`value`'s own setter runs (`!allow_greater && 150 > 100-0` → `100`, `_calc_value`,
`range.cpp:182-200`). The later `min_value`/`max_value` lines only re-clamp that `100`,
and never recover the authored `150`. The same three lines in the editor's order land at
`150`. `hslider/linter.test.ts` holds the full derivation.

For contrast, `Node3D`'s decomposed `position`/`rotation`/`scale` carry
`PROPERTY_USAGE_EDITOR` only (`scene/3d/node_3d.cpp:1526-1531`), with no `STORAGE` flag,
so they are never serialised to a `.tscn`. `Range`'s four properties have no such
restriction (`range.cpp:405,406,408,409`), which makes the Range case real.

**The class is wider than two families.** Many Godot setters in the directories that
hold `.tscn`-declarable `Node` subclasses call a different `set_*` method, across many
classes, including several this codebase implements (`CollisionShape3D`,
`MeshInstance3D`, `AnimatedSprite2D`/`3D`, `GPUParticles2D`/`3D`, `CPUParticles2D`/`3D`,
`Camera2D`, `CollisionObject2D`/`3D`, `NavigationRegion*`). That is a size signal, not a
reachability list: most hits are C++ convenience methods with no `ADD_PROPERTY` binding
(`set_collision_layer_value` is a bitmask helper callable from script, not a `.tscn`
property line). Only `Control` and `Range` are confirmed reachable from a `.tscn`.

`[sub_resource]` blocks parse through the same `TscnParserCore` loop and get the same
order-preserving raw bag (`parseInternalResource`). A resource with a side-effecting
setter (`ParticleProcessMaterial::set_param_min`/`set_param_max`,
`BaseMaterial3D::set_on_top_of_alpha`, `Theme::set_theme_item`, …) is exposed to the same
class of bug in a hand-edited `.tres` or inline resource. This ADR covers node property
blocks only. The same reasoning and the same `linter/propertyOrder.ts` helper apply to
resources.

## Enumerated cost

### Where order is captured

`TscnParserCore.parse()` (`packages/textscene-core/src/parser/TscnParserCore.ts`) builds
each node's property bag as `currentProperties: Record<string, string>`, one key at a
time in a single forward scan (`currentProperties[property.key] = property.value`, and
the multiline path does the same). **No TSCN property key is a numeric string**, so by
the ECMAScript spec (`OrdinaryOwnPropertyKeys`: integer indices first, then string keys
in insertion order), `Object.keys()`/`Object.entries()` on this object yields the file
order, with no code added at the scanning seam.

The lenient parser's node creator (`parseNodeWithRegistry` in `NodeRegistry.ts`) stores
the **same object reference** as `TscnNode.rawProperties` on **each** node, not only
instance nodes. The strict parser's `createSimpleNode` (`StrictTscnParser.ts`) stores
that same object as `TscnNode.properties`: on the strict path, a node's `properties`
**is** the raw, order-preserving bag.

**The scanner and the two node creators keep file order. Only a consumer that reads the
bag through a named key** (`properties.anchors_preset`) **loses it**, which is what each
render-path `parser.ts` does.

### Consumers

- Two consumers hardcode one resolution order for a known setter with a sibling side
  effect: `r3f/controls/controlAnchors.ts` (the Control family) and
  `nodes/2d/ui/shared/range.ts`'s `rangeRatio` (the Range/Slider family). The other
  `parser.ts` files read properties that do not interact in Godot, so a named-key read is
  correct for them.
- Each `linterParser.ts` only calls
  `validatorRegistry.registerAll('Type', { key: v.xxx(...) })`. It validates one key's
  own format and never compares two keys, so no option affects it.
- `Linter.ts`'s Phase 2 (`RuleContext.node.properties`, from `StrictTscnParser`) is the
  raw ordered bag. **A semantic rule can read `Object.keys(node.properties)` for file
  order with no parser change.** Option C does this.

### The apps

`grep -rn "\.properties\b|rawProperties" apps/textscene-web/src apps/textscene-vscode/src apps/textscene-linter/src`
finds nothing. Each app consumes `@textscene/core` through its public surface
(`SceneGraph`, the parser/linter entry points, `useResource`, …), never
`TscnNode.properties`/`rawProperties`. **A change to how `TscnNode` represents
properties, additive or not, breaks no app source.** It stays inside `@textscene/core`.

### Two wrinkles each order-consuming option must answer

1. **A duplicate key stays at its first position.** To re-assign an existing plain-object
   key does not move its enumeration order: only a new key is appended. A `.tscn` that
   writes `offset_left` once before `anchors_preset` and again after it reports as
   "before" under `Object.keys()`, though Godot applies both assignments in order and the
   second one survives. A `Record<string,string>` cannot represent "this key was written
   twice". Only explicit ordered storage (`PropertyEntry[]` or similar, Option A) is
   faithful here. Option B, which reads `Object.keys()`, is not.
2. **`mergeInstanceRoot.ts`'s raw merge produces neither file's order.**
   `{ ...root.rawProperties, ...instanceNode.rawProperties }` keeps a shared key at the
   **root's** position with the **instance's** value, and appends each instance-only key
   after the root's keys. Each order-consuming resolution (Option A or B) is wrong here
   unless this merge path is special-cased.

### The linter side (`StrictTscnParser` / `RuleRegistry` / `ValidatorRegistry`)

Option B forces no change. `ValidatorRegistry`'s per-property format validators
(Phase 1) never compare two keys. `RuleRegistry`'s semantic rules (Phase 2) receive the
raw ordered bag as `node.properties`, so Option C is three ordinary `LintRule`s
(`control-property-order`, `hslider-property-order`, `vslider-property-order`) that read
that order, with no `ParseObserver`/`StrictTscnParser` change.

## Considered options

**(a) Keep full per-node property order in the parse tree**, as a real data-shape change
(for example `TscnNode.rawProperties` typed as ordered entries, or a `Map`). *Cost:* the
scanning seam needs nothing new, the change stays inside `@textscene/core`, and it
handles the duplicate-key wrinkle that Option B cannot. *Failure mode:* it solves what
Option B already solves for each case this corpus or this finding exercises, at the cost
of a type migration through `rawProperties`'s consumers (`mergeInstanceRoot.ts`,
`viewportContent.ts`), for duplicate-key fidelity with no known instance. Rejected as
disproportionate. The storage already keeps order; only Option A's marginal value over B
(duplicate keys) would need the change, and that value is theoretical.

**(b) Add no storage, and special-case the known side-effecting setters at parse time**,
applying Godot's own setter semantics in file order for those keys. The Control resolvers
in `controlAnchors.ts` become order-aware: they read `rawProperties`' key order once and
decide per side whether the authored value or the preset's derived value survives. The
same applies to `rangeRatio()` in `shared/range.ts`. *Cost:* small and local. The two
families' resolvers are the only order-assuming consumers. `rawProperties` carries the
order, and the render parser's typed `ControlProperties` shape stays the same. *Failure
mode:* the `mergeInstanceRoot` wrinkle must be handled explicitly, or the resolvers fall
back to fixed-order behaviour for a node from that path. The duplicate-key wrinkle stays
unhandled. A new side-effecting family costs one more local special case, not a
re-architecture. **This ADR chooses this option** (see Decision).

**(c) Add no structure, and add a linter rule that warns when a scene authors a known
order-sensitive pair in the divergent order, for each family this ADR confirms.**
*Cost:* small, because `RuleRegistry`'s Phase 2 hands a rule the raw ordered bag as
`node.properties`. Three registered rules (`control-property-order`,
`hslider-property-order`, `vslider-property-order`) share one pure helper,
`linter/propertyOrder.ts`'s `targetsBeforeLatestTrigger` (the target keys that sit before
the latest-positioned trigger key present). Both families reduce to one shape: N target
properties silently overwritten by whichever of M trigger properties runs latest. The
sharing stops at that one function, with no rule-authoring framework (a declarative
"hazard spec" registry, or a factory that builds a `LintRule` from a target/trigger
list): two families that share one function do not justify a framework. Each family
keeps its own files, rule names and message wording, because the shapes differ. Control
also carries an operability gate (`layout_mode` versus `anchors_preset`, with no Range
equivalent) that stays bespoke. `HSlider` and `VSlider` register two separately named
rules, because `Range` has no authorable intermediate type in `NODE_BASE_TYPES` to hang
one shared rule off (the same reason `CONTROL_LEAVES` links the sliders straight to
`Control`). *Failure mode:* a warning does not make the renderer correct. Without Option
B (or A), the previewer paints the wrong rect or value for a scene that authors a
divergent order, against "the preview shows what Godot shows" (ADR-0037). A linter rule
helps authors write new scenes correctly. It does not fix the render of a divergent one,
so it complements Option B and does not replace it.

**(d) Do nothing, and record a parity limitation.** *Cost:* none. *Failure mode:* the
renderer stays silently wrong for a hand-authored scene that hits this order, and the
project cannot prevent that, since it accepts uploaded, pasted and hand-edited `.tscn`
as first-class input (Source pane, VS Code extension, file upload). The author gets no
signal. Rejected: "nothing has hit this yet" is not evidence nothing will, and a silent
correctness gap is worse than a flagged one at about the same cost.

The project is pre-1.0 with no back-compat obligations, so "Option A or B is a breaking
change" is not an argument against them. No option changes a public `@textscene/core`
export the apps consume.

## Decision

**Option B is implemented for both confirmed families.** It fits what the evidence shows
(two confirmed families, a few functions, no new storage), and Option A's only real
advantage, duplicate-key fidelity, has no known instance that justifies a type
migration.

`r3f/controls/controlAnchors.ts`'s `resolveControlLayout` replays a Control's raw `.tscn`
property keys in file order. It simulates the setters of
`Control::_set_layout_mode`/`_set_anchors_layout_preset` directly, and tracks
`stored_layout_mode`, `anchor[4]`, `offset[4]` and `h_grow`/`v_grow` as `Control::Data`
does, not as a pairwise "does X come before Y" rule. So it covers all five
order-sensitive pairs, including the unconditional reset of `layout_mode = 0`
(`control.cpp:919-935,927-930`), without pairwise special cases.

`nodes/2d/ui/shared/range.ts`'s `resolveRangeValue` does the same for `Range`. It
replays `min_value`/`max_value`/`page`/`value` against
`Range::set_min`/`set_max`/`set_page`/`set_value` (`range.cpp:211-266`). `set_min` and
`set_max` also constrain each other (`shared->max = MAX(shared->max, shared->min)`,
`max_validated = MAX(p_max, shared->min)`), and both clamp `page`
(`shared->page = CLAMP(shared->page, 0, shared->max - shared->min)`). So `page` is part
of the replay, and `min`/`max`/`page` interact with each other, not only with `value`.
`set_step` is inert as a trigger (it has no `set_value` call of its own,
`range.cpp:243-252`), so the replay excludes it. The `p_step > 0` snap term inside
`_calc_value` (`range.cpp:184-186`) is a separate rendering-fidelity gap that
`rangeRatio` does not model. It stays out of scope, so that an order fix is not mixed
with a new feature.

Both resolvers take the raw ordered keys as an explicit, optional parameter
(`ControlLayoutOrder`/`RangeValueOrder`, both `readonly string[] | undefined`). When that
order is absent or unreliable, they fall back to the fixed-order resolvers and
`rangeRatio`, which assume editor-save order. `TscnNode` has one additive field,
`rawPropertiesOrderReliable?: boolean`, that carries that fact.
`core/NodeRegistry.ts`'s `parseNodeWithRegistry` sets it `true` for each node it builds
(one `TscnParserCore` scan, real file order). `resources/mergeInstanceRoot.ts` sets it
`false` on a merged instance root, whose raw merge is neither file's real order, so a
merged node takes the fixed-order (editor-save) path. `native/solveTree.ts`'s
`controlLayoutOrder(n)` is the one place a `SolveNode` consumer reads that fact. It is
shared by `native/controlRectSolver.ts` (Control) and the `HSlider`/`VSlider`
`Component.tsx`s (Range).

**Not modelled, and cited in `resolveControlLayout`'s own doc:** the
`p_push_opposite_anchor` clamp of `Control::set_anchor` (`control.cpp:758-786`, default
`true`). It is order-sensitive, but a different shape (incremental per-edge state, not
"a later trigger wipes an earlier target") from the five pairs this ADR grounds.

**The duplicate-key wrinkle stays unaddressed**, as Option B always implied. A
`Record<string, string>` cannot represent "this key was written twice", so a `.tscn` that
assigns the same order-sensitive key more than once is read at its first position with
its last value.

**Option C stays, for each family this ADR confirms**: `Control`
(`control-property-order`) and `Range` (`hslider-property-order`,
`vslider-property-order`). It is a complement, not an interim measure: a warning names an
authoring hazard that a human who maintains the file should see, even though the parser
resolves it (`control/linter.ts`'s module doc says so). The three rules share one pure
order-comparison function (`linter/propertyOrder.ts`) and stop short of a rule-authoring
framework.

## Consequences

- **The renderer resolves both families' file order.** A scene that authors a divergent
  order (Control's `anchor_*`/`offset_*`/`grow_*`/`layout_mode` versus
  `anchors_preset`, the reset of `layout_mode = 0`, or Range's `value` versus
  `min_value`/`max_value`/`page`) previews the same rect or value that Godot 4.6.3
  produces for that file order. The acceptance case (the same four `offset_*` values,
  only the order against `anchors_preset = 15` changed) resolves to
  `(0, 0, 1152, 648)` when the offsets precede the preset and `(40, 40, 1352, 768)` when
  they follow it, both in the same build.
- **`pnpm lint:tscn`, the VS Code extension's diagnostics and the web app's Source-pane
  gutter warn** (severity `warning`, an advisory condition, not an error) for:
  - a Control-family node (`control-property-order`) that authors
    `anchor_*`/`offset_*`/`grow_*` before an operational `anchors_preset`, or
    `layout_mode` after one;
  - an `HSlider`/`VSlider` (`hslider-property-order`/`vslider-property-order`) that
    authors `value` before any of `min_value`/`max_value`/`page` that runs after it.

  The existing fixtures are all in editor order (Control) or bounds-before-value order
  (Range), so both rules stay silent on them, and no visual golden depends on the
  divergent orders.
- A third order-sensitive family takes the same fix on both sides: its own resolver reads
  the key order of `rawProperties`/`node.properties` once (like
  `resolveControlLayout`/`resolveRangeValue`), and its linter rule reuses
  `targetsBeforeLatestTrigger` from a new small rule file, as `Range`'s does.

## Known limitations of Option C

- **Neither rule simulates Godot's clamp or overwrite maths.** Both flag each "target
  before its latest trigger" order, whether or not the values would differ once the
  trigger runs. For example, an authored `value` that already fits inside the stale
  default range gets the same warning as one that does not. This is deliberate: the rule
  names an authoring hazard and is not a render simulation, and it is cheaper than a
  copy of each setter's arithmetic in the linter.
