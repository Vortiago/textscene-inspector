/** What Godot says exists, and what this previewer says it parses. */

import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCoreParser } from '../loadCoreLinter.mjs';
import { ENUM_GD } from './paths.mjs';

/**
 * The types the lenient parser recognises, read from the live registry, not
 * scraped from source: a loop over `TWO_D_PHYSICS_TYPES` registers types with
 * no string literal to match. `coverage-report.mjs` reads the same registry.
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
 * One engine run, four answers: the instantiable classes, the Node and Resource
 * property rows, and the Resource hierarchy. One spawn, since Godot start-up
 * dominates the cost and two runs could straddle a version change.
 */
export function enumerateGodotNodes() {
  const proj = mkdtempSync(join(tmpdir(), 'godot-nodes-'));
  const res = spawnSync('xvfb-run', ['-a', 'godot', '--headless', '--path', proj, '-s', ENUM_GD], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  // `error` carries a spawn failure that a null `status` does not name: ENOENT,
  // a timeout, or ENOBUFS past Node's stdout cap. Without it the marker search
  // blames the engine for a spawn that produced no output.
  if (res.error) {
    throw new Error(`Could not run Godot to build the catalog: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(
      `Godot exited ${res.status} while building the catalog:\n${(res.stderr ?? '').slice(-800)}`
    );
  }
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
