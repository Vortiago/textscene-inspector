#!/usr/bin/env node
/**
 * Scaffolds a new TSCN node-type vertical slice and wires its registration
 * imports into the three aggregation files, so adding a node type touches
 * no central file by hand.
 *
 * Usage:
 *   pnpm new:node <TypeName> <category-dir> [options]
 *
 *   <TypeName>      Godot type name, PascalCase (e.g. Marker3D)
 *   <category-dir>  directory under src/nodes/ (e.g. 3d, 2d, physics/3d, paths)
 *
 * Options:
 *   --base <node3d|node2d|node|control>  base slice to extend (default: node3d)
 *   --intent <draws|transform-only|pending>   REQUIRED — what the viewport does
 *   --chain <ParentType>         REQUIRED — Godot parent class, checked against ClassDB
 *   --linter                     generate strict validators + linter wiring
 *   --dry-run                    print the plan without writing anything
 *
 * `--intent` decides the slice's shape, its render registration and its sheet
 * status together, because those three must agree and `sheets.test.mjs` asserts
 * that they do:
 *
 *   draws           a full slice you are about to implement — own types/parser/
 *                   Component, plain render registration, status `unreviewed`.
 *   transform-only  ADR-0008: draws nothing BY DESIGN and is therefore finished.
 *                   Reuses the base parser and component, registers
 *                   `renderIntent: 'transform-only'`, status `linter-only`.
 *   pending         should draw, does not yet. Reuses the base parser and
 *                   registers the base component under `renderIntent: 'pending'`
 *                   — the badge reads the intent, not the absence, so the gap is
 *                   honest without forfeiting `visible` and the workspace split.
 *                   `--base control` is the exception and registers nothing: its
 *                   component lays out anchors rather than passing through.
 *                   Status `unimplemented`.
 *
 * `--chain` no longer writes anything: NODE_BASE_TYPES is derived from the node
 * catalog, so a real Godot type already has its base. It is still required as a
 * spelling check — a name Godot does not know gets no base, and a type with no
 * base receives ZERO inherited validation with no error and no warning. Name
 * the Godot parent even when it is plain `Node`.
 *
 * Examples:
 *   pnpm new:node RayCast3D physics/3d --intent transform-only --chain Node3D --linter
 *   pnpm new:node ProgressBar 2d/ui --base control --intent pending --chain Range --linter
 *   pnpm new:node Decal 3d --intent draws --chain Node3D --linter
 *
 * The conformance guards (barrelCompleteness, reactFree, webExtensionSafe,
 * ruleCoverage) fail the suite if a generated slice is mis-wired.
 *
 * A second mode, `--tier [--rule]`, scaffolds the shared validator set for an
 * ABSTRACT Godot class, which has no parser, component, fixture or sheet
 * because it can never appear in a .tscn.
 *
 * The parts live in `new-node-slice/`: `cli` (the argument contract), `bases`
 * (the four base slices), `ancestry` and `catalogChecks` (what Godot says a type
 * inherits), `wiring` (the aggregation imports), `slice` and `tier` (the two
 * modes), and `templates/` (every file either mode emits).
 */

import { parseArgs } from './new-node-slice/cli.mjs';
import { scaffoldSlice } from './new-node-slice/slice.mjs';
import { scaffoldTier } from './new-node-slice/tier.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.tier) return scaffoldTier(args);
  scaffoldSlice(args);
}

main();
