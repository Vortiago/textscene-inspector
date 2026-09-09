# Resource decoding is organized as resource slices over one parsed form

- Status: Accepted (2026-07-31)
- Related: ADR-0001 (unified slice, React-free linter), ADR-0029 (sub-resource paths),
  ADR-0028 (import sidecars), issue #110 (binary `.scn`/`.res`).

## Context

The fifth architecture review found the two StandardMaterial3D paths decoding the same
Godot text through hand-synced implementations that disagree. The inline
`[sub_resource]` path enforces Godot's rule that albedo alpha alone must NOT force
transparency. The external `.tres` path does exactly that, ignores fifteen
shipped features (`transparency`, `cull_mode`, `normal_scale`, refraction, triplanar,
…), and re-derives value decoding by sniffing string shapes
(`materialProcessing.ts`). Corpus scenes render wrong through the weaker path
(`truck_town` tree leaves opaque and single-sided, `glass.tres` losing transparency and
refraction). The two paths' test suites are disjoint, so the divergence was locked in
rather than caught.

The loading seam itself already existed. `createTresResourceProcessor` fetches a
`.tres` and parses it into a raw-strings parsed form on the generic `resource` bus
slot, documented as "consumers give the parsed file meaning; the pipeline only fetches
and parses the format". TileSet, MeshLibrary and SpriteFrames already consume it.
What did not exist was a uniform shape for the consumers. Each decoder chose its own
file layout, entry-point names, value decoding, and registration, so what a
contributor implements depends on which decoder they happen to read first. Routing was
part of the problem. `ResourceLoader.busTypeFor` guessed a bus tag by substring
(`includes('Material')`), so a supported type could route to a processor that then
refused it (`CanvasItemMaterial` as an `ext_resource`: a working slice behind a
permanent missing-resources row).

## Decision

**Every resource decoder is a resource slice, and every slice consumes one parsed
form.**

- A **resource slice** lives in `resources/<category>/<type>/` with a registration
  object declaring the TSCN type names and file extensions it claims plus its bus tag,
  `types.ts`, and co-located tests. Routing is a lookup over the declared claims.
  Nothing sniffs type names by substring.
- Slices come in **two kinds under one contract**. A **Godot-text slice** additionally
  carries `decode.ts` and `build.ts`. `decode.ts` is pure: a `ParsedResource` section
  (raw property strings plus the owning file's resource tables) in, typed Data out.
  `build.ts` takes Data plus resolved dependencies in, and a THREE object (or plain
  data) out. A **foreign-format slice** (glTF/GLB, images, `.import` sidecars,
  `project.godot`) declares its real parser openly instead of faking the split. The
  parity here is the folder contract, registration, and tests, not hollow entry-point
  names.
- The parsed form is **`ParsedResource`** (renamed from `ParsedTresFile`): header type,
  ext/sub resource tables, and the `[resource]` body as raw Godot-text strings. A
  future binary `.res`/`.scn` loader (#110) produces the same shape, which is what
  makes a decoder format-agnostic. It never learns which serialisation the file used.
- One decoder per type. A type needing both a reactive (JSX) and an imperative
  applier keeps two adapters over the same `decode.ts`. The decode may not fork.
- Blend/enum tables and similar parity constants are ported from Godot source where
  possible, with `pnpm ref:godot` renders as proof, and become the single source both
  renderers derive from.
- Conformance guards enforce the shape in the existing idiom (registry walk plus source
  scrape). Every claimed type resolves to a slice with the required entry points and
  tests. No code outside the loading layer parses a Godot resource serialisation or
  value-shape-sniffs a property bag.

## Decisions made during the campaign (amendments)

- **Naming**: a property-bag decoder is `decode<Type>`. Leaf value scanners
  (`tessellateCurve3D`, `parseCurve3DPoints`, `parseAtlasRegion`) keep `parse*`
  names. They read one literal, not a bag.
- **Bus tags are the cached-artefact kinds** (`texture` `material` `scene`
  `glb` `resource` `arraymesh`). Many Godot-text types share the generic
  `resource` slot (a ParsedResource) and give it meaning in their own decode.
  `busType: null` marks a claimed type the loader never serves
  (`ViewportTexture` resolves by NodePath). Such a slice carries no `decode.ts`
  because no ParsedResource section ever reaches it.
- **Family-helper registration** (the nine collision shapes, the eight
  primitive meshes) keeps its claims table in the helper's co-located test:
  one table per family, accepted by the conformance guard.
- **Routing fixes shipped by claims**: `CanvasItemMaterial`, the three sky
  materials (previously substring-routed to the material bus, which throws),
  and Environment/SpriteFrames/Navigation* (previously unroutable on
  `provideFile`). `StyleBoxTexture` is deliberately unclaimed. No decode
  exists, and a claim is a promise of one, so it takes the null-route
  fallback instead of failing inside the image decoder.
- **Premultiplied alpha**: Godot's PREMULT blend mode programs blend
  attachments only. three's `premultipliedAlpha` flag adds an in-shader
  `rgb *= a` Godot does not have, so both renderers keep it OFF and carry the
  ported factors.
- **AgX tonemapping** reads `tonemap_agx_white` (default 16.29) per
  `Environment::_update_tonemap`, and `tonemap_agx_contrast` is threaded
  through both tonemap paths (in-material chunk and glow composer) so the
  two bake one curve.

## Consequences

- Adding a resource type means adding one slice folder and registering it. The
  loader gains no fields, and the routing table cannot drift from the processors.
- The StandardMaterial3D parity bugs are fixed by construction. `.tres` and inline
  materials flow through the same decode, and one table-driven suite proves the two
  arrival paths equivalent.
- The rename touches every `ParsedTresFile` consumer once. After it, the name no
  longer bakes the text format into a shape binary files will share.
