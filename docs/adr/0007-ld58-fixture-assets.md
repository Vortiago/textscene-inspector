# Commit a curated, downscaled ld-58 fixture subset; drop the music

A curated subset of ld-58 scenes plus their transitive resource closure is committed under `scenes/` as visual-regression fixtures for both apps. ld-58's assets are all third-party (OpenGameArt models/textures under mixed CC licenses requiring attribution, plus a credited music track with no stated license). We therefore: commit the OpenGameArt textures and GLB meshes **downscaled to ≤1024px** (cutting ~109 MB of source assets to a few MB — the previewer never needs print resolution), carry the source `attributions.md` next to them, and **exclude the music track** (no redistribution license).

Only raw `res://`-resolvable files are committed — no Godot `.import` files and no `.godot/` remap directory are needed, because every `ext_resource` carries a direct `path="res://…"` the renderer resolves itself.

Hard to reverse (git history bloat, asset redistribution) and a real trade-off (deterministic both-apps visual verification vs. repository size and third-party licensing), so it is recorded. If any committed asset's license proves incompatible, it is replaced with a neutral placeholder and the real ld-58 folder is used for local-only verification.
