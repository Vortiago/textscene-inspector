# One StandardMaterial3D derivation, two adapters

- Status: Accepted (2026-08-18).
- Related: ADR-0031 (resource slices — a slice's `decode.ts` owns Godot semantics
  and no consumer decodes; this extends that rule one layer outward, from
  DECODING to DERIVING). ADR-0038 (one owner for every program input — it owns
  the merged bag's React key, which is why the derivation below deliberately
  carries no `key`). ADR-0032 (sub-resource paths — the producer-side gate that
  decides which material types are worth addressing at all, and therefore what
  `ORMMaterial3D` does today).

## Context

A decoded `StandardMaterial3D` has to become two different things, because two
consumers need two different shapes of the same material:

- the **resource pipeline** wants a plain `THREE.Material` object it can cache,
  hand to `<primitive>`, and dispose — `buildStandardMaterial`
  (`resources/materials/standardmaterial3d/build.ts`);
- **R3F** wants a JSX element, because prop-diffing a mounted material across
  re-renders is the only thing that makes a re-parse visible at all —
  `<StandardMaterialSlot>` (`r3f/materials/StandardMaterialSlot.tsx`).

Those two differ in exactly one thing: how a material CLASS becomes a thing that
exists — `new THREE.MeshPhysicalMaterial(props)` against
`<meshPhysicalMaterial {...props} />`. Everything upstream of that step is the
same question asked twice: which class does this feature set need, and which
three prop does each Godot scalar become.

It was answered twice, and drifted. `needsPhysicalMaterial` was declared in both
modules, byte-identically, each under a comment asserting it was the single
declaration. `rimSheenColor` and `RIM_SHEEN_ROUGHNESS` were exported from the
loader for sharing and shared by nobody — the slot re-inlined both. Between
them the two modules held seven separate prop-bag constructions: three class
arms in the loader, four in the slot (the no-material fallback, then basic,
physical, standard). Merging them turned up two real defects that had been
invisible precisely because no test could compare the paths: the loader dropped
an `anisotropy_flowmap` it had been handed, and the two derived the albedo
colour in different SHAPES.

That is what a duplicated derivation costs here specifically. A derivation in
this codebase is not glue — it is a PORT of `BaseMaterial3D`'s semantics, and a
port that exists twice is two ports, read by different tests, corrected by
different commits.

## Decision

`standardMaterialBag(scalars, textures)`
(`resources/materials/standardmaterial3d/materialBag.ts`) derives the class and
the prop bag ONCE, and returns them as one discriminated value:

```ts
type StandardMaterialBag =
  | { materialClass: 'basic';    props: THREE.MeshBasicMaterialParameters }
  | { materialClass: 'standard'; props: THREE.MeshStandardMaterialParameters }
  | { materialClass: 'physical'; props: THREE.MeshPhysicalMaterialParameters };
```

`build.ts` maps the class to a constructor. `StandardMaterialSlot.tsx` maps it to
a JSX tag. Neither derives a prop of its own, and neither decodes (ADR-0031).

### Why two ADAPTERS are right where two DERIVATIONS were not

An adapter is a function of the bag whose whole content is the one difference
between the consumers. A derivation is a function of Godot's semantics. The
first genuinely has two instances here; the second has one referent and must
therefore have one implementation.

The discrimination is what turns that from an intention into a checkable one.
The class and the parameters it was derived FOR travel in the same value, so an
adapter cannot pair `'physical'` with a bag it built for `'standard'` — the type
refuses it, in both adapters, for a class arm added later as much as for the
three that exist. What the adapters may still hold on their own is what is
genuinely theirs: `attach` is the mount's prop, and the texture BINDING seam
(`textureBinding.ts`) is crossed by each adapter before it calls in, because
what a slot needs of the texture it samples is per-material state that lands on
a `THREE.Texture` rather than on the bag.

The guard is `arrivalParity.test.tsx`: one material text, its three arrival
paths — an inline `[sub_resource]`, a standalone `.tres`, a `[sub_resource]` of
another `.tres` — and one material state. Two layers, because one cannot see
what the other can: a pure bag guard whose comparison keys ARE the derived bag's,
so every prop is covered by construction rather than by a list to maintain, plus
one mounted texture-bearing snapshot per adapter, that being the post-bag binding
state a pure equality check is blind to and the axis these paths actually
diverged on.

### `needsPhysicalMaterial` is a three capability mapping, not parity logic

```ts
scalars.clearcoat > 0 || scalars.rim > 0 ||
scalars.anisotropy > 0 || scalars.transmission > 0
```

Godot has ONE spatial shader for all four. `FEATURE_CLEARCOAT`, `FEATURE_RIM`,
`FEATURE_ANISOTROPY` and `FEATURE_REFRACTION` are bits of one `feature_mask`
into one `_update_shader` (`scene/resources/material.cpp:685`) — there is no
Godot material class boundary here to be faithful to. three draws the boundary
instead, between `MeshStandardMaterial` and `MeshPhysicalMaterial`, and this
predicate is the whole of our answer to WHERE three draws it.

It lives in the derivation for that reason. A reader who met it as parity logic
would go looking in `material.cpp` for the rule it ports and find none; a reader
who met it in an adapter would reasonably conclude the other adapter had its own.
A new physical-only feature extends exactly this predicate and nothing else.

## Godot's `BaseMaterial3D::MaterialKey` as an audit checklist

Godot decides a material's program identity the same way three does, and writes
it down in one place: `MaterialKey` (`scene/resources/material.h:359-393`),
computed by `_compute_key()` (`:421`), looked up in a static `shader_map`
(`:416`) by `_update_shader` (declared `:530`, body `material.cpp:685`). A field
in that struct IS a program term in Godot, by construction. So a field-by-field
pass over it answers, exhaustively and without invention, the only question that
matters when porting a material: **for each of Godot's program terms, do we
carry it — and as what?**

Three answers are possible. **Program input** — a three term baked into the
compiled program and therefore keyed (ADR-0038); *indirectly* where the field
reaches such a term only through another one it feeds. **Uniform** — carried,
but as per-draw state, a uniform, geometry or object state that a mounted
material may change freely. **Unimplemented** — not carried. A field that is
none of the three says so in its own row.

| `MaterialKey` field | Here | Notes |
| --- | --- | --- |
| `texture_filter` | uniform | Sampler state on the `THREE.Texture`, per texture and per slot (`textureBinding.ts`), which is why a shared cached texture is cloned rather than retagged. Not a program term in three at all. |
| `detail_uv` | unimplemented | No detail layer exists; the detail slots are deliberately absent from `TEXTURE_SLOTS`. |
| `transparency` | split | Its `transparent` half is a program input — a term of three's `opaque` composite (`WebGLPrograms.js:262`) — and keyed. Its `alphaTest` half is a program input that three self-heals on the `> 0` crossing (`Material.js:494-502`), so it is not one of OURS. Both, plus `depthWrite`, come from `rendersInAlphaPass` (`decode.ts:174,207`), the transcription of `ShaderData::uses_alpha_pass` that decides which PASS the surface lands in. |
| `alpha_antialiasing_mode` | program input, indirectly | Read only by `rendersInAlphaPass`, so it reaches three solely through `transparent` (`decode.ts:174`) and `depthWrite` (`:207`). three's own `alphaToCoverage` — a program input, and keyed — is never set from it, so alpha-to-coverage itself is unimplemented here. |
| `shading_mode` | program input | The strongest one here: it selects the material CLASS (`'basic'` for SHADING_MODE_UNSHADED), and React remounts across an element-type change whatever the key says. |
| `blend_mode` | program input, via `opaque` only | The five modes reach three's program identity solely as the `blending === NormalBlending` term of `opaque`; the factors themselves are per-draw GL state (`blendState.ts`). See the uniform-vs-key rule below. |
| `depth_draw_mode` | uniform | `depthWrite`, per-draw state; the mode is resolved against the pass by `godotDepthWrite` (`decode.ts`). |
| `depth_test` | uniform | `depthTest`. `WebGLPrograms` never reads it. |
| `cull_mode` | program input | `side`, which reaches the program as the `doubleSided`/`flipSided` pair (`WebGLPrograms.js:369-370`). Godot's enum names the faces DISCARDED and three's names those KEPT, mapped once in `scalars.ts`. |
| `diffuse_mode` | unimplemented | three has one diffuse BRDF; nothing in the repo reads the property. |
| `specular_mode` | unimplemented | As above. |
| `billboard_mode` | neither | A vertex-shader term in Godot; here it never reaches a material at all — `useBillboard` rotates the object per frame on the CPU, off `materialScalars.billboardMode`. |
| `detail_blend_mode` | unimplemented | With the detail layer. |
| `roughness_channel` | unimplemented | A stated parity limitation: Godot reads the channel named by `roughness_texture_channel`/`metallic_texture_channel` (default RED); three's `roughnessMap`/`metalnessMap` read fixed G/B (`SurfaceMaterialSlot.tsx`). |
| `emission_op` | uniform | Resolved on the CPU into `emissive` + `emissiveIntensity` (`emission.ts`), and only at the point where a texture is known to have landed — the operator is unobservable without one. |
| `distance_fade` | program input, indirectly | `distance_fade_mode` is decoded and read only by `rendersInAlphaPass` — PIXEL_ALPHA puts the surface in the alpha pass. The fade itself is unimplemented. |
| `stencil_mode`, `stencil_flags`, `stencil_compare`, `stencil_reference` | unimplemented | Nothing in the repo reads any of them. |
| `feature_mask` (13 bits) | see below | |
| `flags` (25 bits) | see below | |
| booleans: `deep_parallax` | unimplemented | Godot's is texture-space parallax; our heightmap slot drives three's `displacementMap`, i.e. real vertex displacement, which is a stated parity limitation of its own and not this bit. |
| booleans: `grow` | unimplemented | |
| booleans: `proximity_fade` | program input, indirectly | Decoded for `rendersInAlphaPass` only; the fade itself is unimplemented. |
| booleans: `orm` | non-goal | See below. |
| booleans: `invalid_key` | n/a | Not a derived term: `_compute_key` never sets it, and `BaseMaterial3D`'s constructor sets it to 1 (`material.cpp:4007`) so the first `_update_shader` cannot match. A "no key computed yet" sentinel, with nothing to port. |

**`feature_mask`** — `FEATURE_EMISSION`, `NORMAL_MAPPING`, `RIM`, `CLEARCOAT`,
`ANISOTROPY`, `AMBIENT_OCCLUSION`, `HEIGHT_MAPPING`, `SUBSURFACE_SCATTERING`,
`SUBSURFACE_TRANSMITTANCE`, `BACKLIGHT`, `REFRACTION`, `DETAIL`,
`BENT_NORMAL_MAPPING`.

The four physical features are carried through their SCALAR: `decode.ts` zeroes
`clearcoat`, `rim`, `anisotropy` and `transmission` when the corresponding
`*_enabled` is false, and `needsPhysicalMaterial` then thresholds at `> 0` — the
same thresholds three itself keys on (`WebGLPrograms.js:140-145`), so a Godot
feature bit and a three layer bit move together. One divergence follows and is
deliberate: `rim_enabled = true` with `rim = 0.0` is a distinct program in Godot
(the bit is set) and is not one here. It is unobservable — the emitted code is
`RIM = rim * rim_tex.x` (`material.cpp:1904`), and likewise
`CLEARCOAT = clearcoat * clearcoat_tex.x` (`:1918`) and
`ANISOTROPY = anisotropy_ratio * anisotropy_tex.b` (`:1932`), so the
enabled-but-zero program computes zero. Refraction carries the bit exactly
(`transmission` is set to 1 or 0 by the flag, never by an authored magnitude).

Emission, normal mapping, ambient occlusion and height mapping reach the program
as texture-slot PRESENCE, which is keyed per slot. Unimplemented: subsurface
scattering, subsurface transmittance, backlight, detail, bent normal mapping.

**`flags`** — 25 bits, `FLAG_DISABLE_DEPTH_TEST` through `FLAG_USE_FOV_OVERRIDE`.
Carried: `FLAG_ALBEDO_FROM_VERTEX_COLOR` → `vertexColors`, a program input
(`WebGLPrograms.js:308`), keyed; `FLAG_DISABLE_DEPTH_TEST` → `depthTest`, per-draw
state; `FLAG_USE_TEXTURE_REPEAT` → `wrapS`/`wrapT` (`applyTextureState.ts:144`),
sampler state like `texture_filter`; `FLAG_USE_SHADOW_TO_OPACITY` → read by
`rendersInAlphaPass` only, so it reaches the program indirectly and its shading
effect is unimplemented; `FLAG_UV1_USE_TRIPLANAR` /
`FLAG_UV1_USE_WORLD_TRIPLANAR` → one `triplanar` scalar folded into the
per-surface UV transform, with its own recorded `uv1_offset` limitation
(`SurfaceMaterialSlot.tsx`);
`FLAG_BILLBOARD_KEEP_SCALE` → the CPU billboard, like `billboard_mode`. The
remaining bits are unimplemented HERE — `FLAG_FIXED_SIZE` among them, which is
honoured on the Sprite3D/Label3D path the scope note below describes and not
through this derivation.

**Scope of the table.** It audits the derivation this ADR is about — a scene's
own `StandardMaterial3D`. `Sprite3D` and `Label3D` do not go through it: Godot
builds their material from a fixed property set of its own
(`BaseMaterial3D::get_material_for_2d`), and each node component assembles that
bag itself and hands it straight to `materialProgramInputs`.

## The uniform-vs-key rule

A Godot key term becomes one of OUR key terms unless carrying it as a uniform is
observationally identical and avoids a remount. The exception is not a
concession: a remount throws the material object away, and the canvas lighting
injection owns uniform objects for a canvas item's whole life (ADR-0038's last
consequence), so a key term added without need is a cost paid every time the
value changes.

`CanvasItemMaterial::MaterialKey`
(`scene/resources/canvas_item_material.h:55-71`) is the compact case: three
computed fields (`:90-97`), and all three are divergences with a reason. Its
fourth union member, `invalid_key`, is the same constructor sentinel as
`BaseMaterial3D`'s and is not computed either.

- **`light_mode`** is a **uniform** here. Godot emits it into the shader's
  `render_mode` line — `,unshaded` or `,light_only`
  (`canvas_item_material.cpp:105-114`) — so its three values are three programs.
  Ours is ONE injected fragment program that branches on a `float` uniform,
  `uLightMode` (`r3f/lighting2d/canvasItemLighting.ts`); `canvasItemLightingProps`
  returns the same props and the same `cacheKey` whatever the mode, which is
  what makes it a uniform rather than a key term. Observationally identical, and
  it is exactly the case the exception exists for: keying it would remount a
  canvas item's material — and re-attach its lifetime-owned uniform objects — to
  change something a uniform already changes correctly.
- **`blend_mode`** reaches three's program only through the **`opaque`
  composite** (`WebGLPrograms.js:262`), never in its own right. So it IS keyed,
  but only as one term of one boolean: MIX is the only mode that leaves
  `blending` at `NormalBlending` and can therefore satisfy `opaque`, while ADD,
  SUB, MUL and PREMULT_ALPHA all take `CustomBlending` and are the same program
  as each other, differing in per-draw blend state alone
  (`canvasitemmaterial/build.ts`, ported from
  `material_storage.cpp:651-716`). In Godot every mode compiles its own
  `render_mode blend_*` line, i.e. its own program
  (`canvas_item_material.cpp:84-103`). The divergence is invisible because a
  blend attachment is fixed-function state on both sides.
- **`particles_animation`** emits VERTEX code in Godot — `VERTEX.xy /=
  vec2(h_frames, v_frames)` plus the frame pick and the UV window
  (`canvas_item_material.cpp:118-137`). We answer it **on the CPU, in the
  geometry**: `nodes/2d/cpuparticles2d/particleGeometry.ts` builds each
  particle's quad at `cellWidth`/`cellHeight` and offsets its UVs by
  `uOffset`/`vOffset`, with `flipbookFrame` transcribing the shader's
  `floor` / `clamp` / `mod` chain. It is therefore not a material term here at
  all, and cannot be a key term of a material that never learns about it.

## Cast shadows are instance state, not material state

`cast_shadow` is `GeometryInstance3D` state, applied at shadow-pipeline time
(`servers/rendering/renderer_scene_cull.cpp:732`). It is in neither
`MaterialKey`, and it is not material state in Godot at any point.

It must not become material state here either, and the reason is sharper than
fidelity: a `.tres` material is shared by every node that references it, so
writing one node's `cast_shadow` onto `material.shadowSide` would change every
other node's shadows. The state has to reach three's SHADOW pass without
touching the material the colour pass draws — which is what `Object3D`'s
per-mesh `onBeforeShadow` hook is, since three hands the hook the depth material
it built for that draw, and reassigns that material's `side` per object before
the hook fires. `r3f/shadowCasting.ts` is the whole mapping and carries its own
three and Godot citations per effect. Every one of `RS::ShadowCastingSetting`'s
four values (`servers/rendering/rendering_server.h:1494-1499`) carries a hook,
not just the two that `Object3D.castShadow`'s single boolean cannot express:
Godot's shadow pass keeps the material's own cull while three flips
FrontSide↔BackSide as its own acne mitigation, so honouring the instance's
setting means reaching the depth material in every case.

## `ORMMaterial3D` is a stated non-goal

`ORMMaterial3D` is `BaseMaterial3D` with `mk.orm` set: one packed texture whose
channels replace three separate reads — `AO = orm_tex.r` (`material.cpp:1956`),
`ROUGHNESS = orm_tex.g` and `METALLIC = orm_tex.b` (`:1740-1741`) — with the
individual roughness/metallic/AO properties hidden from the inspector
(`:2694-2696`).

It is not decoded. `BUILDABLE_MATERIAL_TYPES` holds `StandardMaterial3D` and
`ShaderMaterial` only, so `createMaterialFromContent` throws `Unsupported
material type: ORMMaterial3D`, and a producer consults that same set before
minting an address (ADR-0032) — which is what keeps the throw from becoming a
permanent missing-resources row for a file that is present and correct. Two
corpus files reach it today:
`scenes/demos/3d/procedural_materials/materials/wet_concrete.tres` (its own
`[gd_resource]` type) and `scenes/demos/3d/soft_body_physics/cloth.tscn` (a
`[sub_resource]` on a MeshInstance3D surface).

It is a non-goal OF THIS DECISION — the one-derivation rule is not extended to a
resource type the slice does not decode — and it is written down so the throw is
read as the stated boundary rather than as a defect in the derivation. What it is
NOT is a technical blocker, and the ADR says so plainly so the next reader does
not re-derive one that is not there: three's own channel convention already
matches Godot's packing exactly — `roughnessMap` samples `.g`
(`roughnessmap_fragment.glsl.js`), `metalnessMap` `.b`
(`metalnessmap_fragment.glsl.js`) and `aoMap` `.r` (`aomap_fragment.glsl.js`) —
so admitting the type means pointing three slots at one texture and adding it to
`BUILDABLE_MATERIAL_TYPES`. Nothing above changes when that happens: it would be
one more arm of the same derivation, not a second derivation.

## Consequences

- The class choice and every scalar→prop mapping have one implementation. A
  physical-only feature added later extends one predicate, and a class arm added
  later is a compile error in both adapters until both handle it.
- The bag deliberately carries no React `key` and no `attach`. Program identity
  is derived downstream, from the MERGED props, by `materialProgramInputs`
  (ADR-0038) — so the key still describes the material that actually mounts,
  including the recipes an adapter spreads over the bag.
- The audit table is a CHECKLIST, not a promise. Every `unimplemented` row is a
  known gap stated where the next reader of the derivation will meet it, and a
  row that changes is a row this file has to change with it.
- `standardMaterialBag` value-imports `three` and is therefore never reachable
  from the slice's `index.ts`, which the linter's import closure walks (ADR-0031).
  Both adapters already sat on the renderer side of that line.
