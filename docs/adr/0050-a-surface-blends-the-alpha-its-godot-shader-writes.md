# A surface blends the alpha its Godot shader writes

- Status: Accepted (2026-10-07).
- Related: ADR-0038 (one owner for every program input), ADR-0039 (one StandardMaterial3D
  derivation, two adapters).

## Context

A **fade alpha** below 1 sends every surface of a **geometry instance** to the **alpha pass**.
There, the alpha the fragment shader writes reaches the blend, and Godot's scene shader and
three's stock materials write different alphas:

- Godot multiplies the albedo alpha in only where the material reads it. A material with
  `TRANSPARENCY_DISABLED`, or with refraction, keeps the fade alpha alone
  (`material.cpp:1832-1837`). three always multiplies the map and vertex-colour alpha into
  `diffuseColor.a`.
- Godot writes alpha 1 for each fragment a scissor or hash cut keeps
  (`scene_forward_clustered.glsl:1413-1415`). three keeps the cut alpha in the blend.

A `ShaderMaterial` port of Godot's scene shader would match both, but it would lose three's
lighting chunks, which every other material in the previewer draws with.

## Decision

**Keep three's stock materials, and correct the alpha where Godot's shader differs.**

- The derivation records where the Godot shader takes ALPHA from: `readsAlbedoAlpha` and
  `opaqueAfterCut` on the decoded material, or on the Sprite3D and Label3D alpha-cut surface.
- `surfaceAlphaProps` turns that record and the final blend state into props. A MIX surface
  that writes alpha 1 overwrites, which three spells as `NoBlending`. Every other case is a
  `ProgramInjection` on `alphatest_fragment` or `alphahash_fragment`.
- `standardMaterialBag` applies the fade alpha first and the alpha props last, so each adapter
  only installs the result. The reactive adapter passes the injection through
  `materialProgramInputs`, and the imperative adapter through `injectProgram`.
- Only Forward+ semantics apply, because Mobile and Compatibility ignore `transparency`
  (`visual_instance_3d.cpp:524`).

## Consequences

- A surface that is not blended needs no correction: three's `OPAQUE` define writes alpha 1.
- A new alpha source in Godot's scene shader adds a field to the record and a row to
  `surfaceAlphaProps`, not a new material class.
