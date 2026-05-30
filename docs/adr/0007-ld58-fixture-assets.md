# Commit the ld-58 fixture closure in the private repo; strip it before going public

A curated subset of ld-58 scenes plus their transitive `res://` resource closure
is committed under `scenes/ld58/` (mirroring the `res://` tree so paths resolve)
as visual-regression fixtures + showcase progress clips for both apps.

**Repo plan (load-bearing):** this is a PRIVATE development repository. When the
feature set + architecture are ready, the code will be moved to a PUBLIC repo
**with all ld-58 references and assets removed**. So while developing here we
commit the ld-58 scenes/assets as-is for fidelity and progress tracking; the
public-move step is responsible for stripping `scenes/ld58/`, the ld-58 showcase
clips, and any ld-58-specific fixtures. Asset redistribution licensing is
therefore NOT a blocker now (private), and downscaling textures is an optional
repo-size choice rather than a licensing requirement. The music track is still
omitted (not needed for the visual previewer).

Only raw `res://`-resolvable files are committed — no Godot `.import` files and
no `.godot/` remap directory are needed, because every `ext_resource` carries a
direct `path="res://…"` the renderer resolves itself. The web app resolves
`res://x` → `/fixtures/x`, so the closure is committed under `scenes/ld58/`
mirroring that structure and copied to `public/fixtures/` preserving subpaths.

Recorded because the private-now / strip-before-public lifecycle is a deliberate
decision a future contributor must know (don't publish ld-58 assets), and the
`res://`-mirrored fixture layout is non-obvious.
