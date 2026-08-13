/** What GODOT says exists, and what this previewer says it parses. */

import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCoreParser } from '../loadCoreLinter.mjs';
import { ENUM_GD } from './paths.mjs';

/**
 * The types the lenient parser actually recognises, read from the live registry
 * in the built package.
 *
 * This was a `typeName: '…'` scrape of the slice sources, which silently
 * undercounted: `StaticBody2D`, `RigidBody2D` and `CharacterBody2D` are
 * registered by a loop over `TWO_D_PHYSICS_TYPES` with no string literal to
 * match, so the catalog called three shipped types "not implemented". Reading
 * the registry cannot drift from what the parser does, and it is the same
 * source `coverage-report.mjs` uses, so the two agree by construction.
 */
export async function supportedTypes() {
  const { nodeRegistry } = await loadCoreParser();
  return new Set(nodeRegistry.getAllTypeNames());
}

/** The JSON blob printed on the line after `marker`. */
function blobAfter(out, marker, what) {
  const at = out.indexOf(marker);
  if (at === -1) throw new Error(`Godot did not emit ${what}. Output:\n${out.slice(-800)}`);
  return JSON.parse(out.slice(at + marker.length).trim().split('\n')[0]);
}

/**
 * One engine run, all four answers: the instantiable classes, every Node
 * class's own serialised properties, the same rows for every Resource class,
 * and the Resource hierarchy those rows are declared against.
 *
 * Kept as one spawn because starting Godot under xvfb dominates the cost, and
 * because two runs could straddle a version change and disagree about the same
 * engine.
 */
export function enumerateGodotNodes() {
  const proj = mkdtempSync(join(tmpdir(), 'godot-nodes-'));
  const res = spawnSync('xvfb-run', ['-a', 'godot', '--headless', '--path', proj, '-s', ENUM_GD], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  return {
    classes: blobAfter(out, '###NODES_JSON###', 'the node list'),
    properties: blobAfter(out, '###PROPS_JSON###', 'the property list'),
    resourceProperties: blobAfter(out, '###RESOURCE_PROPS_JSON###', 'the resource property list'),
    resourceBases: blobAfter(out, '###RESOURCE_BASES_JSON###', 'the resource base-class map'),
  };
}

export function godotVersion() {
  return (spawnSync('godot', ['--version'], { encoding: 'utf8' }).stdout ?? '').trim().split('\n')[0] || 'unknown';
}
