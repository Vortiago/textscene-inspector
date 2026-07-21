# 3D preview lighting mirrors Godot's editor, not its runtime

- Status: Accepted (2026-07-21)
- Related: ADR-0006 (viewport-mode seam), ADR-0008 (invisible render intent),
  `r3f/TscnCanvas.tsx`, `nodes/3d/worldenvironment/`, `resources/environment/`.

## Context

`TscnSceneContents` mounted an unconditional `ambientLight intensity={0.4}` plus a
`directionalLight position={[5,5,5]}`, on top of whatever lighting the scene carried. That
baseline was invented, not derived: it matches neither of Godot's two answers.

**At runtime Godot adds nothing.** A scene with no lights and no `WorldEnvironment` renders
against the default clear colour with no ambient — near-black. Faithfully reproducing that
would make a previewer that shows the user nothing, which is the reason a fixed fill light
was there in the first place.

**In the editor Godot adds a preview sun and a preview environment, and yields each one
independently to a scene that supplies its own.** This is documented — *"any 3D scene that
doesn't have a WorldEnvironment node, or a DirectionalLight3D, will have a preview turned on
for what it's missing to light the scene"* (`introduction_to_3d.html`) — and the mechanism is
explicit in `editor/scene/3d/node_3d_editor_plugin.cpp`, byte-identical in 4.4 and in the 4.6.3
this project targets:

```cpp
void Node3DEditor::_node_added(Node *p_node) {
  if (EditorNode::get_singleton()->get_scene_root()->is_ancestor_of(p_node)) {
    if (Object::cast_to<WorldEnvironment>(p_node))        { world_env_count++; … }
    else if (Object::cast_to<DirectionalLight3D>(p_node)) { directional_light_count++; … }

bool disable_light = directional_light_count > 0 || !sun_button->is_pressed();
bool disable_env   = world_env_count > 0        || !environ_button->is_pressed();
```

Two independent counters, keyed on node **type** alone: `visible` is never consulted,
OmniLight3D and SpotLight3D do not count, and nodes inside instanced sub-scenes do (they sit
under the scene root). The preview values are equally concrete — the sun is a white,
energy-1.0 `DirectionalLight3D` with shadows on at euler `(-60°, 150°, 0)`, and the
environment is `BG_SKY` over a `ProceduralSkyMaterial` with `sky_top_color = Color(0.385,
0.454, 0.55)` and `ground_bottom_color = Color(0.2, 0.169, 0.133)`.

The yield condition is therefore documented engine behaviour, not a product decision for this
previewer.

## Decision

**The previewer is an editor, so it takes the editor's semantics.** Godot's preview sun and
preview environment are reproduced with Godot's own values and yielded per Godot's own rule:
two independent presence checks over the **live scene tree** (so instanced sub-scenes count,
as they do in the editor), keyed on node type, ignoring `visible`.

Three consequences of taking that seriously:

**The sky is Godot's shader, ported.** `ProceduralSkyMaterial`, `PanoramaSkyMaterial` and
`PhysicalSkyMaterial` are ported from `scene/resources/3d/sky_material.cpp` as three
`ShaderMaterial`s rendered into a cube target. Both projects are MIT, so the ports carry
Godot's copyright and permission notice. The alternative — reimplementing the gradient in
TypeScript — would have reproduced two of the three sky types badly and dropped the sun disk,
which is a visible feature of the sky, not a detail (measured: 3.1% of pixels, locally up to
130/255, when the sun is in frame).

**Ambient is an IBL, because in Godot it is one.** The sky cube feeds
`PMREMGenerator` → `scene.environment`, so it lights diffusely *and* drives reflections —
Godot's `reflection_source` defaults to the background. A `HemisphereLight` approximation was
rejected: it is diffuse-only, so every metallic or smooth material stays visibly wrong.
`ambient_light_energy` rides `scene.environmentIntensity`; `AMBIENT_SOURCE_COLOR` remains a
flat `ambientLight`; `AMBIENT_SOURCE_DISABLED` emits nothing. `AMBIENT_SOURCE_SKY` reads the
IBL, blended with the flat colour by `ambient_light_sky_contribution` — the existing branch
returning `ambient_light_color × energy` for that source is wrong (the colour is inert at the
default contribution of 1.0) and is replaced, not extended.

**`tonemap_mode` is implemented**, mapping Godot's enum onto `gl.toneMapping`. The preview
environment uses FILMIC, and ignoring it is a measured 25/255 mean channel error — 20× the
goldens' threshold. Scene-owned environments default to LINEAR, so this changes only the
preview environment and scenes that set the property explicitly.

The two previews are also exposed as toolbar toggles on the viewport-mode seam, mirroring
Godot's own sun/environment buttons — including their disabled state when the scene supplies
its own, which is what tells a user whether they are looking at their lighting or ours.

## Considered options

**Runtime semantics — add nothing.** Rejected: the most literally faithful option produces a
black viewport for the large class of scenes that expect a game-level environment to exist.
An editor's job is to show you your scene.

**Keep the unconditional fill lights.** Rejected: it double-lights every scene that has its
own lighting, and the fixed 0.4 ambient was silently masking the real defect — that a
`WorldEnvironment` using `BG_SKY` contributed no ambient at all, because we had no IBL.

**Adopt the yield rule without implementing sky ambient.** Rejected as a knowing regression:
yielding to a `BG_SKY` environment that emits nothing makes those scenes darker than both
Godot and our previous behaviour. The yield rule and the sky IBL have to land together.

## Consequences

- **A GL context is now load-bearing for lighting.** Sky rendering and PMREM need a real
  `WebGLRenderer`, so the path must no-op cleanly under `@react-three/test-renderer`; unit
  tests assert the seam (which sky, which uniforms, whether a preview mounts) and the goldens
  assert the pixels.
- **Most 3D baselines move at once**, and they move for a reason no diff can show. They are
  therefore validated against **Godot reference renders** produced by `scripts/godot-ref`
  (Godot 4.6.3 under Xvfb/llvmpipe) rather than eyeballed — the same tooling that lets any
  future parity question be measured instead of derived. The preview sun and preview
  environment are `Node3DEditor` members and **do not exist at runtime**, which is what
  `godot --path` runs: a reference render of scene X must inject them per the yield rule and
  suppress any project `default_environment`, or it depicts a Godot that never lit the scene
  and the comparison calibrates to the wrong target.
- **The sky depends on the scene's directional lights** (Godot's shader takes `LIGHT0..3`),
  so sky generation reads the same live-tree query the yield rule uses. One query, two
  consumers.
- Post-processing the preview environment enables — glow/bloom — is still not reproduced;
  that needs a compositor pass this renderer does not have.
