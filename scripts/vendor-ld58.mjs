#!/usr/bin/env node
// Deploy-time corpus vendor — never committed, but part of the DEPLOYED site.
/**
 * Vendor the ld-58 Godot project into scenes/ld58/ as an OPT-IN local corpus,
 * mirroring the scenes/games/ scheme (scripts/vendor-godot-games.mjs): the
 * source is fetched/copied locally, never committed (scenes/ld58/ is gitignored),
 * and `pnpm generate:fixtures` writes its manifest to the gitignored
 * apps/textscene-web/src/fixtures.ld58.ts that fixturesAll.ts merges at runtime.
 *
 * The ld-58 repo is public but repo-EXTERNAL: nothing here is committed, and
 * the previewer builds and every committed fixture works without it. The
 * DEPLOYED site does include this corpus (ADR-0033): `pnpm
 * build:site` vendors it (script-stripped) alongside the games corpora
 * before the production web build — anonymous fetch, no credentials needed.
 *
 * Usage:
 *   pnpm vendor:ld58                       # fetch the default repo @ main
 *   pnpm vendor:ld58 --ref <branch|tag>    # fetch a specific ref
 *   pnpm vendor:ld58 --url <git-url>        # fetch a different remote
 *   pnpm vendor:ld58 --src /path/to/ld-58   # copy from a local checkout
 *
 * Re-runnable: wipes+recreates scenes/ld58/ each run, copies exactly the FILES
 * manifest, and applies a DETERMINISTIC, mechanical script-strip to every
 * .tscn — we don't execute C#/GDScript and the .cs/.gd files aren't vendored, so
 * every `[ext_resource type="Script" …]` header and every `script = ExtResource(…)`
 * property line is removed and the header's `load_steps` is recomputed. All other
 * content (nodes, sub_resources, Texture2D/PackedScene ext_resources, res:// refs)
 * is preserved byte-faithfully. `pnpm vendor:ld58` chains `generate:fixtures`.
 *
 * The parts live in `vendor-ld58/`: `files` (the manifest), `stripScripts`
 * (the .tscn transform) and `vendor` (the flow).
 */

import { vendorLd58 } from './vendor-ld58/vendor.mjs';

vendorLd58();
