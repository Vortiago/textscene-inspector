#!/usr/bin/env node
/**
 * Vendors the public ld-58 Godot project, script-stripped, into the gitignored scenes/ld58/. Then
 * `generate:fixtures` writes the gitignored apps/textscene-web/src/fixtures.ld58.ts, which
 * fixturesAll.ts merges at runtime. The build works without it, and `pnpm build:site` vendors it
 * for the deployed site (ADR-0033) through an anonymous fetch.
 *
 * @example
 *   pnpm vendor:ld58                       # the default repo at main
 *   pnpm vendor:ld58 --ref <branch|tag>    # a specific ref
 *   pnpm vendor:ld58 --url <git-url>       # a different remote
 *   pnpm vendor:ld58 --src /path/to/ld-58  # a local checkout
 */

import { vendorLd58 } from './vendor-ld58/vendor.mjs';

vendorLd58();
