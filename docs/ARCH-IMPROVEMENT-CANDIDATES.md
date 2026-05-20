# Architecture improvement candidates — scout report

Scan of `feat/r3f-16-audio-animation` @ `a83a7f8` on 2026-05-20.

Scout: `arch-scout` (read-only). This report is for `architect-2-2` to curate before passing to `team-lead`. No code changes proposed yet; just smell + sketch.

Architect-2-2 has already flagged on the parallel `feat/r3f-migration` branch:
SelectionContext bloat, provider stack depth, `*Highlight` near-clones, CSS
token leaks. **None of those four are in this report** — this is a complementary
set found on the upstream branch where those WIs haven't been layered in yet.

## Summary

11 candidates. Top theme: **shallow per-type facades hiding a single deep
pattern**. The codebase has independently re-derived the same caching /
deduplication / boilerplate-validator pattern 3–4 times across the resource
layer, the linter validators, and the renderer-side gizmo helpers. Each
instance is locally cheap but the aggregate denies leverage — a fix to "how
caching works" or "how a validator reports errors" must be made in N places.

Two candidates (#1, #2) are the highest-impact: the linter `linterParser.ts`
files total **9,488 LOC** of near-identical validator boilerplate, and
`ResourceLoader` plus `SceneLoader` plus `createResourceProcessor` reimplement
the same cache/inflight/eventBus machine three times. Both have a clean
deepening path with no behaviour change.

The remainder are lower-impact but worth queueing.

---

## Candidate 1: Deepen `PropertyValidator` so per-type linter files shrink 70 %

**Where**:
- `packages/textscene-core/src/nodes/**/linterParser.ts` (31 files, 9,488 LOC total)
- `packages/textscene-core/src/linter/ValidatorRegistry.ts:14-18` (the shallow interface)
- e.g. `packages/textscene-core/src/nodes/3d/meshinstance3d/linterParser.ts:21-42` and `:104-125` and `:131-152` (six identical "non-negative number" validators)

**Smell**: Every `linterParser.ts` is a list of inline functions whose body is
the same five steps: `parseInt/parseFloat → NaN check → range check → return
{severity, message, line, column: key.length+3, code}`. Look at
`meshinstance3d/linterParser.ts:104-205` — five copy-pastes of "non-negative
float" varying only in property name and error code. Same shape in `Camera3D`
(`fov` 1-179, `size` >0), `Node3D` (scale, position formats), every light, every
physics body. Regexes for `Vector3`, `Transform3D`, `Quaternion`, `Basis`,
`NodePath`, `Vector2` are redefined in 15+ files.

`ValidatorRegistry.PropertyValidator` is the type signature `(key, value, line)
=> ParseError | null`. The interface is shallow — every caller is forced to know
the full ParseError shape, hand-code the message, hand-code the column offset
arithmetic.

**Deletion test**: delete `linterParser.ts` for `MeshInstance3D`. The validator
data (which properties + their expected format/range + the error code) doesn't
vanish — it just needs to live somewhere. Today that "somewhere" is 30 lines of
boilerplate per property. With a deeper validator interface it could be 2 lines
per property.

**Deepening opportunity**: `ValidatorRegistry` exposes a richer set of
**validator combinators** (`enum(0..3, labels)`, `numberRange(min, max)`,
`vector3()`, `transform3D()`, `nodePath()`, `resourceReference()`,
`indexedProperty('surface_material_override', resourceReference())`). Each
combinator is a one-liner returning a `PropertyValidator`. The per-type
`linterParser.ts` shrinks from 200–600 LOC to a flat property → combinator map.

**Proposed shape**:
```typescript
validatorRegistry.registerAll('MeshInstance3D', {
  cast_shadow: validators.enum(0, 3, ['OFF', 'ON', 'DOUBLE_SIDED', 'SHADOWS_ONLY']),
  gi_mode: validators.enum(0, 2, ['DISABLED', 'STATIC', 'DYNAMIC']),
  visibility_range_begin: validators.nonNegativeFloat,
  visibility_range_end: validators.nonNegativeFloat,
  layers: validators.intRange(1, 1048575, 'bits 1-20'),
  mesh: validators.resourceReference,
  transform: validators.transform3D,
  'surface_material_override/*': validators.indexedResourceReference,
});
```

A single file `linter/validators/index.ts` owns the regexes, the error-code
naming convention, and the column-offset arithmetic.

**Effort**: moderate. ~31 files to rewrite, but mechanically; each shrinks
by ~70 %. The combinator file is ~150 LOC.

**Impact**: testability win + locality win + surface-area win.
- Tests for "non-negative float validation works" live in one place, not 12.
- Adding a new format (`Color`, `Vector4`) means one combinator, not 15
  redefined regexes.
- Linter bundle size shrinks proportionally.
- Future LLM edits to "add validation for property X" become trivial — the
  combinators are self-documenting.

**Reviewer (architect-2-2) action**: accept. This is the single largest
deepening opportunity in the codebase right now.

---

## Candidate 2: Collapse `ResourceLoader` + `SceneLoader` + `createResourceProcessor` to one deep cache

**Where**:
- `packages/textscene-core/src/resources/ResourceLoader.ts` (345 LOC, mostly per-type pass-throughs)
- `packages/textscene-core/src/resources/loaders/SceneLoader.ts` (205 LOC)
- `packages/textscene-core/src/resources/createResourceProcessor.ts` (188 LOC)

**Smell**: Three implementations of the same machine — `Map<path, T|null>` for
cache, `Set<path>` for inflight, emit `requested/loading/loaded/failed` events,
deduplicate parallel requests, cache failures-as-null.

- `createResourceProcessor.ts:54-187` implements it functionally for textures, materials, GLBs.
- `loaders/SceneLoader.ts:19-203` re-implements the **same machine** as a class for PackedScene because "scenes parse via TscnParser, not via a file-content processor". The difference is the `process()` step — everything else is duplicated.
- `ResourceLoader.ts:140-180` has nine per-type pass-through methods (`requestTexture`, `requestMaterial`, `requestScene`, `requestGLB`, `clearTextureCache`, `clearMaterialCache`, …) all delegating to the underlying processor. `ResourceLoader` adds zero behaviour beyond fan-out.

`ResourceLoader.provideFile()` at `:267-305` is forced to **sniff the metadata
type and dispatch to the right pass-through** — the surface area exposes every
type as a separate method, so a generic "re-request this path" is hand-coded as
a switch.

**Deletion test**: delete the `requestTexture/requestMaterial/requestScene/
requestGLB` methods on `ResourceLoader`. The callers (e.g. `useResource.ts:209`,
`r3f-main.tsx:120`) need a way to request a path. But every one of them already
**knows the type** — they routed through `getProcessorAccess(type)` to pick
the right pass-through. The shallow type-tagged surface earns nothing.

Same deletion test on `SceneLoader` as a class: drop it, write a `process()`
function for PackedScene that delegates to `TscnParser`, register it via
`createResourceProcessor`. The cache/inflight/event machinery disappears.

**Deepening opportunity**: `ResourceLoader` becomes a **uniform multi-type cache
keyed by `(type, path)`**, with `request(type, path)`, `getCached(type, path)`,
`clearCache(path?, type?)`, `provideFile(path)` (auto-routes via the type table).
PackedScene processor is just another `createResourceProcessor` instance whose
`process()` calls `parser.parse(content)`.

**Proposed shape**:
```typescript
class ResourceLoader {
  private processors = new Map<ResourceType, ResourceProcessor<unknown>>();
  request<T>(type: ResourceType, path: string): void { ... }
  getCached<T>(type: ResourceType, path: string): T | null | undefined { ... }
  clearCache(path?: string, type?: ResourceType): void { ... }  // type-erasing fan-out lives here
  provideFile(path: string): void { ... }  // re-requests through the right processor
}
```

The nine per-type `request*` / `clear*Cache` / `clear*CacheByPath` methods
collapse to three. `useResource.ts`'s `getProcessorAccess` switch (lines 59-76)
becomes `loader.processors.get(type)`.

**Effort**: complex. Touches all R3F node components transitively (via
`useResource`), but the changes are surface-level renames; the actual loading
behaviour is preserved exactly. Test coverage is high here; refactor is safe.

**Impact**: locality + leverage + surface-area win.
- The "what happens when a path resolves/fails" rule lives in one place
  (currently in three).
- Adding a new resource type (e.g. `AudioStream`) becomes a one-line registration
  of a `createResourceProcessor` instance, not "add a class field + 6 methods
  on `ResourceLoader`".
- `provideFile()`'s switch-on-type sniffer (`:288-304`) becomes a trivial
  `processors.get(metadata?.type).request(path)`.

**Reviewer (architect-2-2) action**: accept, but only after candidate #1. They
don't conflict but #1 reduces the linter test churn first.

---

## Candidate 3: Extract `useTHREEHelper` hook from four gizmo near-clones

**Where**:
- `packages/textscene-core/src/r3f/nodes/lights/lightHelpers.tsx:25-94` — three near-identical components: `DirectionalLightGizmo`, `PointLightGizmo`, `SpotLightGizmo`
- `packages/textscene-core/src/r3f/nodes/camera3d/Component.tsx:177-193` — `CameraGizmo`, a fourth instance of the same pattern
- (forward-looking: WI-R3F-16's audio gizmo at `audio/audiostreamplayer3d/Component.tsx:69-86` uses a *different* shape — pure JSX, no helper — but if it ever grows a `THREE.Helper`-style live update it would be a fifth)

**Smell**: Each of the four gizmos is:
```typescript
const [helper, setHelper] = useState<THREE.XHelper | null>(null);
useEffect(() => {
  const target = ref.current;
  if (!target) return;
  const created = new THREE.XHelper(target, ...args);
  setHelper(created);
  return () => { created.dispose?.(); };
}, [ref]);
useFrame(() => { helper?.update(); });  // (not on CameraHelper — see below)
if (!helper) return null;
return <primitive object={helper} />;
```

`CameraGizmo` is identical minus the `useFrame` (camera helpers don't need
per-tick update). Four implementations of the same lifecycle — the only
varying parts are (a) which `THREE.*Helper` constructor, (b) the constructor
args, (c) whether per-frame update is needed.

**Deletion test**: delete `DirectionalLightGizmo`. The `useState/useEffect/
useFrame/primitive` cluster doesn't vanish — it's needed for any THREE helper
that auto-tracks a target. With a `useTHREEHelper` hook, deleting the four
components leaves zero duplicated lifecycle code.

**Deepening opportunity**: a hook `useTHREEHelper<H, T>(targetRef, factory,
{ tickUpdate })` returns a `H | null`. The four call sites become 6-line
components — `<primitive object={useTHREEHelper(...)} />`.

**Proposed shape**:
```typescript
function useTHREEHelper<H extends THREE.Object3D, T extends THREE.Object3D>(
  targetRef: RefObject<T | null>,
  factory: (target: T) => H & { dispose?: () => void; update?: () => void },
  options?: { tickUpdate?: boolean }
): H | null { ... }

// caller:
function DirectionalLightGizmo({ lightRef }: { lightRef: RefObject<THREE.DirectionalLight | null> }) {
  const helper = useTHREEHelper(lightRef,
    (light) => new THREE.DirectionalLightHelper(light, 1.0, 0xffff00),
    { tickUpdate: true });
  return helper ? <primitive object={helper} /> : null;
}
```

**Effort**: simple. ~30 LOC for the hook + small rewrites of four components.

**Impact**: locality + leverage.
- THREE helper lifecycle (dispose semantics, suspension safety, ref-stability)
  lives in one place.
- New gizmos (skeleton, particles, area3D) become one-liners.

**Reviewer (architect-2-2) action**: accept. Architect-2-2 already proposed an
analogous `useBoxHelper` hook in F-3 of the architecture review for the
`SelectionHighlight`/`HoverHighlight` clones. This is the same shape applied to
the gizmo family. Consider folding both into a single PR (one hook covers both
THREE.Helper and THREE.BoxHelper since the lifecycle is identical).

---

## Candidate 4: Stop forcing rules-of-hooks gymnastics in `MeshInstance3D` material texture loading

**Where**: `packages/textscene-core/src/r3f/nodes/meshinstance3d/Component.tsx:97-172`

**Smell**: The component calls `useResource(...)` **six times in a fixed order**
for the six texture slots (albedo / normal / roughness / metallic / emission /
ao), passing `''` (empty path) when a slot isn't populated. The component file
explains the constraint in a long comment block (`:97-101`):

> *"Hooks must be called unconditionally, in stable order — `TEXTURE_PROPERTIES`
> is the canonical ordering so even an empty request still calls each hook with
> an `''` path placeholder, which the hook treats as a no-op"*

This is a workaround for React's rules-of-hooks limitation, not a domain truth.
It also has a quiet correctness limit: **`SecondarySurfaceMaterial`
(`:285-325`) can't load textures at all**, because doing so would require
calling `useResource` in a render-time loop over `materialSubResources`.
There's even an apologetic comment about this (`:286-291`).

The `useMemo` chain that follows (`:149-172`) — `albedoMap`, `normalMap`,
`roughnessMap`, `metalnessMap`, `emissiveMap`, `aoMap` — is six identical
`useMemo(() => transformedTexture(textureSlots.X, uvTransform), [...])`.

**Deletion test**: delete the per-slot `useResource` calls. The information they
collect (six textures by path) doesn't vanish, but the rules-of-hooks reason
for the duplication does — if it were a single `useResources(paths: string[])`
hook returning a `Map<path, ResourceResult>`, the slot count would no longer
be hard-coded.

**Deepening opportunity**: a hook `useResources<T>(requests: Array<{ path:
string; type: ResourceType }>, options?)` that internally manages an array of
subscribers. R3F components pass a dynamic-length list; the hook handles the
fan-out. Secondary-surface materials can then load their own textures. The
six-fold `useMemo` chain collapses to one map over the result map.

This is currently the **single biggest blocker for fully-faithful multi-surface
material rendering** — the parity-audit `WI-R3F-19` patched the primary slot's
textures but explicitly punted on secondary-surface textures because of the
hooks constraint.

**Proposed shape**:
```typescript
const results = useResources(
  TEXTURE_PROPERTIES.flatMap((slot) =>
    textureRequests[slot] ? [{ slot, path: textureRequests[slot], type: 'Texture2D' }] : []
  )
);
// results: ReadonlyMap<string, ResourceResult<THREE.Texture>>
```

**Effort**: moderate. The hook itself is ~50 LOC. The MeshInstance3D rewrite
is mechanical. Secondary-surface texture loading is a small bonus follow-up.

**Impact**: testability + leverage + parity-correctness win.
- One test covers "n parallel resource requests behave correctly", not six.
- Multi-surface meshes finally render with their own per-surface textures.
- Future material slots (e.g. clearcoat, rim) cost one line, not three (hook
  + slot mapping + useMemo).

**Reviewer (architect-2-2) action**: accept, but flag the **rules-of-hooks
correctness invariant** in the hook's docstring — the dynamic-length contract
is the load-bearing detail.

---

## Candidate 5: `InstancePlaceholder` / missing-texture placeholder duplication across node components

**Where**:
- `packages/textscene-core/src/r3f/NodeDispatcher.tsx:213-223` — `InstancePlaceholder` (magenta wireframe + drei text)
- `packages/textscene-core/src/r3f/nodes/meshinstance3d/Component.tsx:197-237` — missing-texture and unresolved-mesh placeholders (magenta wireframe + drei text)
- `packages/textscene-core/src/r3f/nodes/sprite3d/Component.tsx` — same pattern for missing texture (per file structure)
- (Also referenced in WI-R3F-16's audio gizmo as a yellow speaker — different colour but same "editor-only widget" shape)

**Smell**: Three copies of "small magenta wireframe box + a floating drei
`<Text>` label". The contract — "render an editor-only marker that signals
something failed to resolve" — is repeated as plain JSX in each component
instead of being a reusable widget.

**Deletion test**: delete the `InstancePlaceholder` function. The behaviour
("show a magenta box + missing-name label") needs to exist somewhere; today
it's open-coded in 2-3 places.

**Deepening opportunity**: `<MissingResourcePlaceholder reason="missing scene"
path={path} />` — a single component, configurable colour and label. Pairs
naturally with extending to a `<NodeStatusBadge>` for the future "node has a
parse warning" UX. Could also encode a uniform convention: missing →
magenta, info → cyan, warning → orange.

**Proposed shape**:
```typescript
function MissingResourcePlaceholder({ reason, path, color = 0xff00ff }: Props) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <InternalTextLabel text={`${reason}: ${path}`} position={[0, 0.7, 0]} fontSize={0.12} />
    </group>
  );
}
```

**Effort**: simple.

**Impact**: locality + readability.
- One place to evolve the "missing resource" visual language.
- Node components shrink slightly; intent ("this resource is missing") becomes
  the JSX, not the placeholder shape.

**Reviewer (architect-2-2) action**: accept, low priority. Bundle with another
WI rather than its own.

---

## Candidate 6: `propertyFormatter.ts` per-type files are doing string formatting that could be data

**Where**: `packages/textscene-core/src/nodes/**/propertyFormatter.ts` (11 files, 752 LOC)
- e.g. `meshinstance3d/propertyFormatter.ts:1-58`
- e.g. `lights/shared/propertyFormatter.ts:1-107`
- e.g. `camera3d/propertyFormatter.ts:1-104`

**Smell**: Each `propertyFormatter.ts` does the same shape — group properties
into `PropertySection[]`, with hand-coded title strings, label strings,
enum-to-label tables (`['OFF', 'ON', 'DOUBLE_SIDED', 'SHADOWS_ONLY']` in two
files; projection mode labels in another), and ad-hoc include-this-property
conditionals (`if (properties.castShadow !== undefined)`).

The enum-to-label arrays are **the same enum values that linterParser.ts
validates against**. So the data exists twice: once as `validators.enum(0, 3,
['OFF', 'ON', 'DOUBLE_SIDED', 'SHADOWS_ONLY'])` (per Candidate #1) and once as
formatter labels.

**Deletion test**: a node type that opts out of `propertyFormatter.ts` and
just renders `Object.entries(properties)` would lose pretty labels and grouping
but nothing critical. The file is more presentation than logic — most of it
is "if X exists, push { label, value }" patterns.

**Deepening opportunity**: a `propertyDescriptors` table per node-type that
declares **both** the validation shape AND the display label / section
membership. Single source of truth. Validators read it, formatters read it.

**Proposed shape**:
```typescript
const meshInstance3DPropertyDescriptors = {
  cast_shadow: {
    validator: validators.enum(0, 3, ['OFF', 'ON', 'DOUBLE_SIDED', 'SHADOWS_ONLY']),
    section: 'Mesh',
    label: 'Cast Shadow',
    formatter: (v) => ['OFF', 'ON', 'DOUBLE_SIDED', 'SHADOWS_ONLY'][v],
  },
  // ...
};
```

The validator combinator from #1 already encodes the labels; the formatter
inherits them.

**Effort**: complex. Requires #1 to land first. Touches all 11 formatter
files + the linter files.

**Impact**: locality win (medium-large).
- Enum-label drift between validator messages and details-panel display
  becomes impossible.
- Adding a property = one line, not three (parser, formatter, validator).

**Reviewer (architect-2-2) action**: decide-later. The win is real but #1
alone delivers most of the value; this is the follow-up consolidation. Don't
schedule until #1 lands and stabilises.

---

## Candidate 7: `transformFromNode3DProperties` is the implicit Node3D base; surface it as a hook

**Where**:
- `packages/textscene-core/src/r3f/nodeTransform.ts` (used everywhere)
- `packages/textscene-core/src/r3f/nodes/meshinstance3d/Component.tsx:57-60`
- `packages/textscene-core/src/r3f/nodes/camera3d/Component.tsx:23-26`
- `packages/textscene-core/src/r3f/nodes/audio/audiostreamplayer3d/Component.tsx:38-41`
- `packages/textscene-core/src/r3f/nodes/sprite3d/Component.tsx:66-69`
- `packages/textscene-core/src/r3f/nodes/lights/{directionallight3d,omnilight3d,spotlight3d}/Component.tsx` (per pattern)
- Total: 8+ component files duplicate the same `useMemo(() => transformFromNode3DProperties(properties), [properties])` call.

**Smell**: 8 components, identical 4-line `useMemo` pre-amble destructuring
`{ position, rotation, scale }`. The function is pure but the `useMemo`
wrapping is repeated. Stable-identity matters here — without `useMemo`,
R3F-side transform recomputes per render.

Worse, `Camera3D.tsx:33-45` adds a *second* useMemo on top to apply
`h_offset / v_offset`, opening a path where another node type could similarly
need to "extend the transform". Each component opens its own path because
there's no shared hook to extend.

**Deletion test**: delete the `useMemo` from one component. Behaviour
correct, but ID stability lost (might cause R3F to remount or re-compute).
The `useMemo` is load-bearing for performance.

**Deepening opportunity**: `useNode3DTransform(properties, options?)` — a hook
that returns `{ position, rotation, scale }`. Options encode "apply h/v offset"
or "apply billboard"; future extensions add their own.

**Proposed shape**:
```typescript
const { position, rotation, scale } = useNode3DTransform(properties);
// or
const { position, rotation, scale } = useNode3DTransform(properties, { hvOffset: true });
```

**Effort**: simple.

**Impact**: locality + readability. Low priority. Mostly aesthetics today;
becomes load-bearing if h/v-offset-style extensions multiply.

**Reviewer (architect-2-2) action**: decide-later. Bundle with the next node
work pass that touches multiple components.

---

## Candidate 8: `parseResourceReference` lives in `resources/SubResourceResolver.ts` but is called from `r3f/`, `parser/`, `linter/`

**Where**:
- `packages/textscene-core/src/resources/SubResourceResolver.ts:16-30` — single function
- Called from: `r3f/NodeDispatcher.tsx`, `r3f/nodes/meshinstance3d/Component.tsx`, `r3f/nodes/sprite3d/Component.tsx`, `linter/resourceChecker.ts` (re-derives the regex), several other places

**Smell**: The file is named for a defunct module (`SubResourceResolver` —
historical note in the file itself says the rest of it was deleted in WI-R3F-6).
A single 14-line pure utility lives at a path that no longer describes its
purpose.

`linter/resourceChecker.ts:25` re-derives the same regex (`/^(SubResource|
ExtResource)\("([\w-]+)"\)$/`) because the linter shouldn't depend on the
`resources/` module (bundle-size architecture per CLAUDE.md). So the regex
exists in two places.

**Deletion test**: delete the file; move `parseResourceReference` to
`utils/resourceReference.ts`. The "SubResourceResolver" file disappears with
no functional loss. Bundle-size constraint is preserved if `utils/` stays
THREE-free.

**Deepening opportunity**: `utils/resourceReference.ts` with `parseReference`,
`matchReference(type, value)`, `formatReference(type, id)`. Linter's
`resourceChecker.ts` imports the same utility; the regex is defined once.

**Effort**: trivial.

**Impact**: surface-area + locality. Tiny. Cleanup, not transformation.

**Reviewer (architect-2-2) action**: accept, fold into a janitor PR.

---

## Candidate 9: `r3f-main.tsx` toolbar is 50 lines of inline-style div soup

**Where**: `apps/textscene-web/src/r3f-main.tsx:140-193`

**Smell**: The toolbar JSX is a 53-line div with inline `style={...}` props
specifying `display: 'flex'`, paddings, borders, colours. This pattern violates
the CSS-token system that the rest of the codebase uses (per CLAUDE.md and
architect-2-2's F-6 finding).

Architect-2-2's review covered the **module-CSS** files but not this — the
toolbar is in the host app, not in the shared component library. Tokens like
`#3e3e42`, `#252526`, `#fff` are hex literals in this file, breaking the
"VS Code theme integration via `--tsi-*` fallback chain" architecture (`UI #5`).

**Deletion test**: delete the inline styles, restyle via CSS module. The
behaviour is the same but the tokens become consumable by `<vscode-extension>`'s
theme integration. Today, if the VS Code extension reused `<TscnPreviewShell>`,
the toolbar would still render with light-on-dark hex colours regardless of
the user's VS Code theme.

**Deepening opportunity**: extract a `<PreviewToolbar>` shared component in
`r3f/components/` that takes `<ViewportSelector>` + `<FileUpload>` + `<UploadedFilesChip>`
+ `<ErrorBanner>` slots. CSS-module driven, token-friendly. Web app + future
VS Code-host toolbar share one shell.

**Effort**: simple-moderate. Extract + restyle.

**Impact**: locality + parity. Today the toolbar is divergent between hosts
by construction.

**Reviewer (architect-2-2) action**: accept, queue alongside the VS Code parity
WIs. Architect-2-2 already noted in F-5 that "the `toolbar` slot is a raw
ReactNode injection at the top of the shell" was a divergence-risk; this is the
concrete first instance of that drift on the web side.

---

## Candidate 10: `TscnPreviewShell` parses inline; the parse should be a hook so tests can re-use it

**Where**: `packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx:59-96` (the `parseContent` helper) and `:105-108` (the `useMemo` wrapping it)

**Smell**: `parseContent` is a local pure function with a custom `ParseResult`
type. It's wrapped in a `useMemo` keyed on `[content, rootScenePath]`. Anyone
who wants to drive the same parse — a test, a different shell variant, a CLI
preview — has to re-import the parser + builder + scene-graph mapping
themselves.

`TscnPreviewShell.test.tsx` already does this duplication (per CLAUDE.md TODO
list). And future host shells (a popout panel, a side-by-side compare view)
would each re-derive the same parse pipeline.

**Deletion test**: delete `parseContent`; export a hook `useParsedScene(content,
rootScenePath)` that returns `{ sceneGraph, error }`. Same behaviour, callable
from tests and alt shells.

**Deepening opportunity**: a `useParsedScene` hook (or a `parseSceneContent`
pure function exported from `core/`). Shell composes that with `<HierarchyProvider
value={ ... }>`. Two-line shell parse code.

**Effort**: trivial.

**Impact**: testability + leverage. Hook callable from a test renderer without
mounting the full shell.

**Reviewer (architect-2-2) action**: accept, fold into the next WI that touches
the shell.

---

## Candidate 11: `useViewportSelection`'s `expandedRef` smells like context leaking into a hook

**Where**: `packages/textscene-core/src/r3f/hooks/useViewportSelection.tsx:54-77`

**Smell**: The hook reads `expandedNodePaths` from `useSelection()`, then
mirrors it into a `useRef` (`expandedRef`), syncs it in a `useEffect`, and
**reads from the ref inside `select`** to avoid stale closures over the set.
This is a workaround for "I need the latest `expandedNodePaths` but I don't
want to recreate `select`'s `useCallback` on every set mutation".

It works, but the layering is awkward — the `expanded` state nominally lives
on `SelectionContext`, but its **read pattern from within the viewport handler**
needs ref-stability that the context can't provide. The architect-2-2 review's
F-1 finding about SelectionContext absorbing too many responsibilities (on the
parallel branch) suggests this hook is the canary for "ref-map state belongs
in a different shape than React state".

**Deletion test**: delete the `expandedRef` + sync effect. The closure
captures the *initial* expanded set; selecting a node correctly updates
state once but subsequent expanded-set changes from elsewhere stop reflecting
in the auto-expand-ancestors logic. So the ref is load-bearing.

**Deepening opportunity**: a `getLatest`-style read hook (`useLatest(value)`
or `useStableCallback`) that encapsulates the "mirror context value into a ref
for non-React-render read" pattern. Multiple components in the eventual
ref-map / hover / camera-control system are likely to need it (architect-2-2's
F-1 hints at this).

Alternative: factor expanded-set updates onto an imperative API (`expandedSet`
exposes `.add(path)` / `.delete(path)`) so handlers don't need React state at
all for that slice.

**Effort**: simple.

**Impact**: locality + future-proofing. Removes a recurring footgun pattern.

**Reviewer (architect-2-2) action**: decide-later. Pair with architect-2-2's
F-1 follow-up — if SelectionContext gets split, this hook's relationship to
each slice clarifies, and the right shape might fall out naturally.

---

## Closing notes

The two highest-impact items (#1 and #2) are independent and could land in
parallel. Both are mechanical refactors with strong test coverage already in
place — risk is low, payoff is several thousand LOC of clearer code and a
strictly deeper interface in two of the most-touched subsystems.

Items #3 (gizmo hook) and #5 (placeholder) are quick wins; bundle them with the
next aesthetic / parity WI.

Items #4 (multi-texture hook), #6 (property descriptors), and #9 (toolbar
extraction) unblock specific future capabilities (multi-surface textures,
property metadata unification, VS Code toolbar parity). Schedule per their
unblocking targets.

Items #7, #8, #10, #11 are small janitor-style cleanups; bundle into a
"hygiene" WI when there's bandwidth.

No candidate proposes a framework swap or rewrite. Each can be implemented
behind the existing public surface with no breaking changes to host apps.
