# 3D preview lighting mirrors Godot's editor, not its runtime

- Status: Accepted
- Related: ADR-0006 (viewport-mode seam), ADR-0008 (invisible render intent),
  `r3f/TscnCanvas.tsx`, `nodes/3d/worldenvironment/`, `resources/environment/`.

## Context

An invented baseline light (a fixed `ambientLight intensity={0.4}` plus a
`directionalLight position={[5,5,5]}` on top of the scene's own lighting) matches
neither of Godot's two answers.

**At runtime Godot adds nothing.** A scene with no lights and no `WorldEnvironment`
renders against the default clear colour with no ambient: near-black. A previewer that
copies this shows the user nothing.

**In the editor Godot adds a preview sun and a preview environment, and yields each one
on its own to a scene that supplies its own.** The Godot documentation
(`introduction_to_3d.html`) states that a 3D scene without a WorldEnvironment node or a
DirectionalLight3D gets a preview of what it is missing. The mechanism is in
`editor/scene/3d/node_3d_editor_plugin.cpp`, the same in 4.4 and in the 4.6.3 this
project targets:

```cpp
void Node3DEditor::_node_added(Node *p_node) {
  if (EditorNode::get_singleton()->get_scene_root()->is_ancestor_of(p_node)) {
    if (Object::cast_to<WorldEnvironment>(p_node))        { world_env_count++; … }
    else if (Object::cast_to<DirectionalLight3D>(p_node)) { directional_light_count++; … }

bool disable_light = directional_light_count > 0 || !sun_button->is_pressed();
bool disable_env   = world_env_count > 0        || !environ_button->is_pressed();
```

There are two independent counters, keyed on node **type** alone. `visible` is not read,
OmniLight3D and SpotLight3D do not count, and nodes inside instanced sub-scenes do count,
because they sit under the scene root. The preview sun is a white, energy-1.0
`DirectionalLight3D` with shadows on at euler `(-60°, 150°, 0)`. The preview environment
is `BG_SKY` over a `ProceduralSkyMaterial` with `sky_top_color = Color(0.385, 0.454, 0.55)`
and `ground_bottom_color = Color(0.2, 0.169, 0.133)`.

The yield condition is documented engine behaviour, not a product decision for this
previewer.

## Decision

**The previewer is an editor, so it takes the editor's semantics.** It reproduces Godot's
preview sun and preview environment with Godot's own values, and yields them by Godot's
own rule: two independent presence checks over the **live scene tree** (so instanced
sub-scenes count, as in the editor), keyed on node type, with `visible` ignored.

This has three consequences:

**The sky is Godot's shader, ported.** `ProceduralSkyMaterial`, `PanoramaSkyMaterial` and
`PhysicalSkyMaterial` are ported from `scene/resources/3d/sky_material.cpp` as three
`ShaderMaterial`s rendered into a cube target. Both projects are MIT, so the ports carry
Godot's copyright and permission notice. A gradient reimplemented in TypeScript would
reproduce two of the three sky types badly and drop the sun disk. The sun disk is a
visible feature of the sky (measured: 3.1% of pixels, locally up to 130/255, when the sun
is in frame).

**Ambient is an IBL, because in Godot it is one.** The sky cube feeds `PMREMGenerator` and
then `scene.environment`, so it lights diffusely and also drives reflections. Godot's
`reflection_source` defaults to the background. A `HemisphereLight` approximation is
rejected: it is diffuse-only, so each metallic or smooth material stays visibly wrong.
`ambient_light_energy` sets `scene.environmentIntensity`. `AMBIENT_SOURCE_COLOR` is a
flat `ambientLight`. `AMBIENT_SOURCE_DISABLED` emits nothing. `AMBIENT_SOURCE_SKY` reads
the IBL, blended with the flat colour by `ambient_light_sky_contribution`. For that
source, `ambient_light_color × energy` is wrong: the colour is inert at the default
contribution of 1.0.

**`tonemap_mode` is implemented**, mapping Godot's enum onto `gl.toneMapping`. The preview
environment uses FILMIC. Ignoring it gives a measured 25/255 mean channel error, 20 times
the goldens' threshold. A scene-owned environment defaults to LINEAR, so this changes only
the preview environment and scenes that set the property.

The two previews are also toolbar toggles on the viewport-mode seam. They mirror Godot's
own sun and environment buttons, including the disabled state when the scene supplies its
own. That state tells a user whether they see their own lighting or the preview.

## Considered options

**Runtime semantics: add nothing.** Rejected. It gives a black viewport for the large
class of scenes that expect a game-level environment. An editor's job is to show you your
scene.

**Keep the unconditional fill lights.** Rejected. They double-light each scene that has
its own lighting. The fixed 0.4 ambient also hides a real defect: without an IBL, a
`WorldEnvironment` using `BG_SKY` contributes no ambient.

**Adopt the yield rule without sky ambient.** Rejected. Yielding to a `BG_SKY`
environment that emits nothing makes those scenes darker than Godot. The yield rule and
the sky IBL must land together.

## Consequences

- **Lighting needs a GL context.** Sky rendering and PMREM need a real `WebGLRenderer`, so
  the path must no-op cleanly under `@react-three/test-renderer`. Unit tests assert the
  seam (which sky, which uniforms, whether a preview mounts), and the goldens assert the
  pixels.
- **Most 3D baselines depend on the preview lighting**, so they are validated against
  **Godot reference renders** from `scripts/godot-ref` (Godot 4.6.3 under Xvfb/llvmpipe),
  not by eye. The preview sun and preview environment are `Node3DEditor` members and do
  not exist at runtime, which is what `godot --path` runs. A reference render of a scene
  must inject them by the yield rule and suppress any project `default_environment`.
  Otherwise it shows a Godot that never lit the scene, and the comparison calibrates to
  the wrong target.
- **The sky depends on the scene's directional lights** (Godot's shader takes
  `LIGHT0..3`), so sky generation reads the same live-tree query as the yield rule. One
  query has two consumers.
- A compositor pass reproduces the glow that the preview environment enables. It ports
  Godot's own bright pass, weighted mip pyramid and blend modes. The pass mounts only
  when the scene has content that can bloom, so a scene with nothing bright pays nothing
  and renders the same either way, as in Godot.
