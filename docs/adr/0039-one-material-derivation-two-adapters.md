# One StandardMaterial3D derivation, two adapters

- Status: Accepted.
- Related: ADR-0031 (resource slices: a slice's `decode.ts` owns Godot semantics and no
  consumer decodes. This ADR extends that rule one layer outward, from decoding to
  deriving). ADR-0038 (one owner for each program input: it owns the merged bag's React
  key, so the derivation below carries no `key`). ADR-0032 (sub-resource paths: the
  producer-side gate that decides which material types are worth addressing, and so what
  `ORMMaterial3D` does).

## Context

A decoded `StandardMaterial3D` must become two different things, because two consumers
need two shapes of the same material:

- the **resource pipeline** wants a plain `THREE.Material` object it can cache, pass to
  `<primitive>` and dispose: `buildStandardMaterial`
  (`resources/materials/standardmaterial3d/build.ts`);
- **R3F** wants a JSX element, because prop-diffing a mounted material across re-renders
  is the only thing that makes a re-parse visible: `<StandardMaterialSlot>`
  (`r3f/materials/StandardMaterialSlot.tsx`).

The two differ in one thing only: how a material class becomes an object,
`new THREE.MeshPhysicalMaterial(props)` against `<meshPhysicalMaterial {...props} />`.
Everything before that step is the same question: which class does this feature set
need, and which three prop does each Godot scalar become.

Two answers to that question drift. A derivation in this codebase is not glue: it is a
port of `BaseMaterial3D`'s semantics, and a port that exists twice is two ports, read by
different tests and corrected by different commits. For example, two copies of the
derivation can drop an `anisotropy_flowmap` on one path, or derive the albedo colour in
different shapes, and no test compares the paths.

## Decision

`standardMaterialBag(scalars, textures)`
(`resources/materials/standardmaterial3d/materialBag.ts`) derives the class and the prop
bag once, and returns them as one discriminated value:

```ts
type StandardMaterialBag =
  | { materialClass: 'basic';    props: THREE.MeshBasicMaterialParameters }
  | { materialClass: 'standard'; props: THREE.MeshStandardMaterialParameters }
  | { materialClass: 'physical'; props: THREE.MeshPhysicalMaterialParameters };
```

`build.ts` maps the class to a constructor. `StandardMaterialSlot.tsx` maps it to a JSX
tag. Neither derives a prop of its own, and neither decodes (ADR-0031).

### Why two adapters are right where two derivations are not

An adapter is a function of the bag whose whole content is the one difference between the
consumers. A derivation is a function of Godot's semantics. The first has two instances
here. The second has one referent, so it must have one implementation.

The discrimination makes that checkable. The class and the parameters it was derived for
travel in the same value, so an adapter cannot pair `'physical'` with a bag built for
`'standard'`: the type refuses it in both adapters, for a later class arm as much as for
the three that exist. What the adapters may still hold on their own is what is theirs.
`attach` is the mount's prop. Each adapter crosses the texture binding seam
(`textureBinding.ts`) before it calls in, because what a slot needs of the texture it
samples is per-material state that lands on a `THREE.Texture`, not on the bag.

The guard is `arrivalParity.test.tsx`: one material text, its three arrival paths (an
inline `[sub_resource]`, a standalone `.tres`, a `[sub_resource]` of another `.tres`), and
one material state. It has two layers, because each sees what the other cannot. A pure
bag guard compares on the derived bag's own keys, so each prop is covered by construction
and not by a list to maintain. One mounted texture-bearing snapshot per adapter covers
the post-bag binding state, which a pure equality check cannot see and which is the axis
these paths diverge on.

### `needsPhysicalMaterial` is a three capability mapping, not parity logic

```ts
scalars.clearcoat > 0 || scalars.rim > 0 ||
scalars.anisotropy > 0 || scalars.transmission > 0
```

Godot has one spatial shader for all four. `FEATURE_CLEARCOAT`, `FEATURE_RIM`,
`FEATURE_ANISOTROPY` and `FEATURE_REFRACTION` are bits of one `feature_mask` into one
`_update_shader` (`scene/resources/material.cpp:685`), so there is no Godot material class
boundary to be faithful to. three draws the boundary instead, between
`MeshStandardMaterial` and `MeshPhysicalMaterial`, and this predicate is the whole answer
to where three draws it.

So it lives in the derivation. A reader who met it as parity logic would look in
`material.cpp` for the rule it ports and find none. A reader who met it in an adapter
would conclude the other adapter had its own. A new physical-only feature extends this
predicate and nothing else.

## Godot's `BaseMaterial3D::MaterialKey` as an audit checklist

Godot decides a material's program identity the same way three does, and writes it down
in one place: `MaterialKey` (`scene/resources/material.h:359-393`), computed by
`_compute_key()` (`:421`), looked up in a static `shader_map` (`:416`) by
`_update_shader` (declared `:530`, body `material.cpp:685`). A field in that struct is a
program term in Godot by construction. So a field-by-field pass over it answers, with
nothing invented, the question that matters when a material is ported: **for each of
Godot's program terms, does the previewer carry it, and as what?**

Three answers are possible. **Program input**: a three term baked into the compiled
program and therefore keyed (ADR-0038), *indirectly* where the field reaches such a term
only through another one it feeds. **Uniform**: carried, but as per-draw state, a
uniform, geometry or object state that a mounted material may change freely.
**Unimplemented**: not carried. A field that is none of the three says so in its own row.

| `MaterialKey` field | Here | Notes |
| --- | --- | --- |
| `texture_filter` | uniform | Sampler state on the `THREE.Texture`, per texture and per slot (`textureBinding.ts`), which is why a shared cached texture is cloned, not retagged. Not a program term in three. |
| `detail_uv` | unimplemented | No detail layer exists. The detail slots are absent from `TEXTURE_SLOTS` on purpose. |
| `transparency` | split | Its `transparent` half is a program input, a term of three's `opaque` composite (`WebGLPrograms.js:262`), and keyed. Its `alphaTest` half is a program input that three self-heals on the `> 0` crossing (`Material.js:494-502`), so it is not one of this codebase's. Both, plus `depthWrite`, come from `rendersInAlphaPass` (`decode.ts:174,207`), the transcription of `ShaderData::uses_alpha_pass` that decides which pass the surface lands in. |
| `alpha_antialiasing_mode` | program input, indirectly | Read only by `rendersInAlphaPass`, so it reaches three only through `transparent` (`decode.ts:174`) and `depthWrite` (`:207`). three's own `alphaToCoverage`, a keyed program input, is never set from it, so alpha-to-coverage itself is unimplemented here. |
| `shading_mode` | program input | The strongest one here: it selects the material class (`'basic'` for SHADING_MODE_UNSHADED), and React remounts across an element-type change whatever the key says. |
| `blend_mode` | program input, through `opaque` only | The five modes reach three's program identity only as the `blending === NormalBlending` term of `opaque`. The factors themselves are per-draw GL state (`blendState.ts`). See the uniform-versus-key rule below. |
| `depth_draw_mode` | uniform | `depthWrite`, per-draw state. `godotDepthWrite` (`decode.ts`) resolves the mode against the pass. |
| `depth_test` | uniform | `depthTest`. `WebGLPrograms` never reads it. |
| `cull_mode` | program input | `side`, which reaches the program as the `doubleSided`/`flipSided` pair (`WebGLPrograms.js:369-370`). Godot's enum names the faces discarded, and three's names those kept, mapped once in `scalars.ts`. |
| `diffuse_mode` | unimplemented | three has one diffuse BRDF. Nothing in the repo reads the property. |
| `specular_mode` | unimplemented | As above. |
| `billboard_mode` | neither | A vertex-shader term in Godot. Here it never reaches a material: `useBillboard` rotates the object per frame on the CPU, off `materialScalars.billboardMode`. |
| `detail_blend_mode` | unimplemented | With the detail layer. |
| `roughness_channel` | unimplemented | A stated parity limitation: Godot reads the channel named by `roughness_texture_channel`/`metallic_texture_channel` (default RED). three's `roughnessMap`/`metalnessMap` read fixed G/B (`SurfaceMaterialSlot.tsx`). |
| `emission_op` | uniform | Resolved on the CPU into `emissive` + `emissiveIntensity` (`emission.ts`), and only where a texture is known to have landed: the operator is unobservable without one. |
| `distance_fade` | program input, indirectly | `distance_fade_mode` is decoded and read only by `rendersInAlphaPass`: PIXEL_ALPHA puts the surface in the alpha pass. The fade itself is unimplemented. |
| `stencil_mode`, `stencil_flags`, `stencil_compare`, `stencil_reference` | unimplemented | Nothing in the repo reads any of them. |
| `feature_mask` (13 bits) | see below | |
| `flags` (25 bits) | see below | |
| booleans: `deep_parallax` | unimplemented | Godot's is texture-space parallax. The heightmap slot here drives three's `displacementMap`, that is real vertex displacement, which is a stated parity limitation of its own and not this bit. |
| booleans: `grow` | unimplemented | |
| booleans: `proximity_fade` | program input, indirectly | Decoded for `rendersInAlphaPass` only. The fade itself is unimplemented. |
| booleans: `orm` | non-goal | See below. |
| booleans: `invalid_key` | n/a | Not a derived term: `_compute_key` never sets it, and `BaseMaterial3D`'s constructor sets it to 1 (`material.cpp:4007`) so the first `_update_shader` cannot match. A "no key computed yet" sentinel, with nothing to port. |

**`feature_mask`**: `FEATURE_EMISSION`, `NORMAL_MAPPING`, `RIM`, `CLEARCOAT`,
`ANISOTROPY`, `AMBIENT_OCCLUSION`, `HEIGHT_MAPPING`, `SUBSURFACE_SCATTERING`,
`SUBSURFACE_TRANSMITTANCE`, `BACKLIGHT`, `REFRACTION`, `DETAIL`, `BENT_NORMAL_MAPPING`.

The four physical features are carried through their scalar. `decode.ts` zeroes
`clearcoat`, `rim`, `anisotropy` and `transmission` when the matching `*_enabled` is
false, and `needsPhysicalMaterial` then thresholds at `> 0`, the same thresholds three
keys on (`WebGLPrograms.js:140-145`), so a Godot feature bit and a three layer bit move
together. One divergence follows, on purpose: `rim_enabled = true` with `rim = 0.0` is a
distinct program in Godot (the bit is set) and is not one here. It is unobservable. The
emitted code is `RIM = rim * rim_tex.x` (`material.cpp:1904`), and likewise
`CLEARCOAT = clearcoat * clearcoat_tex.x` (`:1918`) and
`ANISOTROPY = anisotropy_ratio * anisotropy_tex.b` (`:1932`), so the enabled-but-zero
program computes zero. Refraction carries the bit exactly: the flag sets `transmission`
to 1 or 0, never an authored magnitude.

Emission, normal mapping, ambient occlusion and height mapping reach the program as
texture-slot presence, which is keyed per slot. Unimplemented: subsurface scattering,
subsurface transmittance, backlight, detail, bent normal mapping.

**`flags`**: 25 bits, `FLAG_DISABLE_DEPTH_TEST` through `FLAG_USE_FOV_OVERRIDE`.
Carried:

- `FLAG_ALBEDO_FROM_VERTEX_COLOR` → `vertexColors`, a program input
  (`WebGLPrograms.js:308`), keyed.
- `FLAG_DISABLE_DEPTH_TEST` → `depthTest`, per-draw state.
- `FLAG_USE_TEXTURE_REPEAT` → `wrapS`/`wrapT` (`applyTextureState.ts:144`), sampler
  state like `texture_filter`.
- `FLAG_USE_SHADOW_TO_OPACITY` → read by `rendersInAlphaPass` only, so it reaches the
  program indirectly, and its shading effect is unimplemented.
- `FLAG_UV1_USE_TRIPLANAR` / `FLAG_UV1_USE_WORLD_TRIPLANAR` → one `triplanar` scalar
  folded into the per-surface UV transform, with its own recorded `uv1_offset`
  limitation (`SurfaceMaterialSlot.tsx`).
- `FLAG_BILLBOARD_KEEP_SCALE` → the CPU billboard, like `billboard_mode`.

The other bits are unimplemented here. `FLAG_FIXED_SIZE` is one of them: the
Sprite3D/Label3D path in the scope note below honours it, not this derivation.

**Scope of the table.** It audits the derivation this ADR is about: a scene's own
`StandardMaterial3D`. `Sprite3D` and `Label3D` do not go through it. Godot builds their
material from a fixed property set of its own (`BaseMaterial3D::get_material_for_2d`),
and each node component assembles that bag itself and passes it to
`materialProgramInputs`.

## The uniform-versus-key rule

A Godot key term becomes a key term here unless a uniform is observationally identical
and avoids a remount. The exception has a cost reason: a remount throws the material
object away, and the canvas lighting injection owns uniform objects for a canvas item's
whole life (ADR-0038's last consequence), so a key term added without need is a cost paid
each time the value changes.

`CanvasItemMaterial::MaterialKey` (`scene/resources/canvas_item_material.h:55-71`) is the
compact case: three computed fields (`:90-97`), and all three are divergences with a
reason. Its fourth union member, `invalid_key`, is the same constructor sentinel as
`BaseMaterial3D`'s and is not computed either.

- **`light_mode`** is a **uniform** here. Godot emits it into the shader's `render_mode`
  line, `,unshaded` or `,light_only` (`canvas_item_material.cpp:105-114`), so its three
  values are three programs. Here it is one injected fragment program that branches on a
  `float` uniform, `uLightMode` (`r3f/lighting2d/canvasItemLighting.ts`).
  `canvasItemLightingProps` returns the same props and the same `cacheKey` whatever the
  mode, which makes it a uniform and not a key term. It is observationally identical,
  and it is the case the exception exists for: a key would remount a canvas item's
  material, and re-attach its lifetime-owned uniform objects, to change something a
  uniform already changes correctly.
- **`blend_mode`** reaches three's program only through the **`opaque` composite**
  (`WebGLPrograms.js:262`), never in its own right. So it is keyed, but only as one term
  of one boolean. MIX is the only mode that leaves `blending` at `NormalBlending` and can
  satisfy `opaque`. ADD, SUB, MUL and PREMULT_ALPHA all take `CustomBlending` and are the
  same program as each other, and differ in per-draw blend state alone
  (`canvasitemmaterial/build.ts`, ported from `material_storage.cpp:651-716`). In Godot
  each mode compiles its own `render_mode blend_*` line, that is its own program
  (`canvas_item_material.cpp:84-103`). The divergence is invisible, because a blend
  attachment is fixed-function state on both sides.
- **`particles_animation`** emits vertex code in Godot: `VERTEX.xy /=
  vec2(h_frames, v_frames)` plus the frame pick and the UV window
  (`canvas_item_material.cpp:118-137`). Here it is answered **on the CPU, in the
  geometry**: `nodes/2d/cpuparticles2d/particleGeometry.ts` builds each particle's quad
  at `cellWidth`/`cellHeight` and offsets its UVs by `uOffset`/`vOffset`, with
  `flipbookFrame` transcribing the shader's `floor` / `clamp` / `mod` chain. So it is not
  a material term here, and cannot be a key term of a material that never learns about
  it.

## Cast shadows are instance state, not material state

`cast_shadow` is `GeometryInstance3D` state, applied at shadow-pipeline time
(`servers/rendering/renderer_scene_cull.cpp:732`). It is in neither `MaterialKey`, and it
is not material state in Godot at any point.

It must not become material state here either. A `.tres` material is shared by each node
that references it, so to write one node's `cast_shadow` onto `material.shadowSide` would
change each other node's shadows. The state must reach three's shadow pass without
touching the material the colour pass draws. `Object3D`'s per-mesh `onBeforeShadow` hook
does that: three passes the hook the depth material it built for that draw, and
reassigns that material's `side` per object before the hook fires.
`r3f/shadowCasting.ts` is the whole mapping and carries its own three and Godot citations
per effect. Each of the four values of `RS::ShadowCastingSetting`
(`servers/rendering/rendering_server.h:1494-1499`) carries a hook, not only the two that
the single boolean of `Object3D.castShadow` cannot express. Godot's shadow pass keeps the
material's own cull, while three flips FrontSide↔BackSide as its own acne mitigation, so
to honour the instance's setting means to reach the depth material in each case.

## `ORMMaterial3D` is a stated non-goal

`ORMMaterial3D` is `BaseMaterial3D` with `mk.orm` set: one packed texture whose channels
replace three separate reads, `AO = orm_tex.r` (`material.cpp:1956`),
`ROUGHNESS = orm_tex.g` and `METALLIC = orm_tex.b` (`:1740-1741`), with the individual
roughness/metallic/AO properties hidden from the inspector (`:2694-2696`).

It is not decoded. `BUILDABLE_MATERIAL_TYPES` holds `StandardMaterial3D` and
`ShaderMaterial` only, so `createMaterialFromContent` throws `Unsupported material type:
ORMMaterial3D`. A producer reads that same set before it mints an address (ADR-0032),
which keeps the throw from becoming a permanent missing-resources row for a file that is
present and correct. Two corpus files reach it:
`scenes/demos/3d/procedural_materials/materials/wet_concrete.tres` (its own
`[gd_resource]` type) and `scenes/demos/3d/soft_body_physics/cloth.tscn` (a
`[sub_resource]` on a MeshInstance3D surface).

It is a non-goal of this decision: the one-derivation rule does not extend to a resource
type the slice does not decode. It is written down so the throw reads as the stated
boundary, not as a defect in the derivation. It is not a technical blocker. three's own
channel convention matches Godot's packing: `roughnessMap` samples `.g`
(`roughnessmap_fragment.glsl.js`), `metalnessMap` `.b` (`metalnessmap_fragment.glsl.js`)
and `aoMap` `.r` (`aomap_fragment.glsl.js`). To admit the type means to point three slots
at one texture and add it to `BUILDABLE_MATERIAL_TYPES`. It would be one more arm of the
same derivation, not a second derivation.

## Consequences

- The class choice and each scalar→prop mapping have one implementation. A later
  physical-only feature extends one predicate, and a later class arm is a compile error
  in both adapters until both handle it.
- The bag carries no React `key` and no `attach`, on purpose. `materialProgramInputs`
  (ADR-0038) derives program identity downstream, from the merged props, so the key
  describes the material that mounts, including the recipes an adapter spreads over the
  bag.
- The audit table is a checklist, not a promise. Each `unimplemented` row is a known gap,
  stated where the next reader of the derivation meets it, and a row that changes is a
  row this file must change with it.
- `standardMaterialBag` value-imports `three`, so the slice's `index.ts`, which the
  linter's import closure walks, never reaches it (ADR-0031). Both adapters sit on the
  renderer side of that line.
