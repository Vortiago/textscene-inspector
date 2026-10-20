/**
 * The render registrations the node slices declare in their `*.r3f.ts` files, read from source: the
 * types each one registers, its `renderIntent`, and whether its component draws or only mounts a base
 * that draws nothing. The badge reads the intent, so the guards hold the intent to the component.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { BASES, GEOMETRY_INSTANCE_BASE } from '../new-node-slice/bases.mjs';
import { findRepoRoot } from '../repoRoot.mjs';

export const NODES_ROOT = join(findRepoRoot(), 'packages/textscene-core/src/nodes');

/** A `nodeComponentRegistry` or `controlComponentRegistry` call, up to the `});` that closes it. */
const REGISTER_CALL = /\b(node|control)ComponentRegistry\.register\(\{([\s\S]*?)\}\);/g;
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g;

/**
 * The component modules of the bases a slice mounts to keep `visible` and the workspace split
 * while it draws nothing of its own. `Control` is not one: it lays out positioned divs.
 */
function invisibleBaseModules(nodesRoot) {
  return new Set(
    [...Object.values(BASES), GEOMETRY_INSTANCE_BASE]
      .filter((base) => base.invisibleBase)
      .map((base) => join(nodesRoot, base.dir, 'Component'))
  );
}

/** Each named import's local name, mapped to its module specifier. */
function importSpecifiers(source) {
  const specifiers = new Map();
  for (const [, names, from] of source.matchAll(NAMED_IMPORT)) {
    for (const name of names.split(',')) {
      const local = name
        .trim()
        .split(/\s+as\s+/)
        .pop();
      if (local) specifiers.set(local, from);
    }
  }
  return specifiers;
}

/**
 * Each `register({...})` call in one `*.r3f.ts` source. `typeName` is null for a family loop,
 * whose `loopConstant` names the list its sibling `index.ts` exports. `componentFrom` is the
 * component's module specifier, or null for a component the file defines itself.
 */
export function parseRegistrationCalls(source) {
  const imports = importSpecifiers(source);
  const loopConstant = /for \(const typeName of ([A-Z0-9_]+)\)/.exec(source)?.[1] ?? null;
  return [...source.matchAll(REGISTER_CALL)].map(([, registry, body]) => {
    const component = /Component:\s*([A-Za-z0-9_]+)/.exec(body)?.[1];
    return {
      registry,
      typeName: /typeName:\s*'([A-Za-z0-9_]+)'/.exec(body)?.[1] ?? null,
      loopConstant,
      componentFrom: (component && imports.get(component)) ?? null,
      intent: /renderIntent:\s*'([a-z-]+)'/.exec(body)?.[1] ?? 'draws',
      scenePass: /scenePass:/.test(body),
    };
  });
}

/** The quoted type names in the `<constant> = [...]` literal of a family's `index.ts`. */
function loopTypeNames(r3fFile, loopConstant) {
  const sibling = readFileSync(join(dirname(r3fFile), 'index.ts'), 'utf8');
  const literal = new RegExp(`${loopConstant}\\s*=\\s*\\[([^\\]]*)\\]`).exec(sibling);
  return literal ? [...literal[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]) : [];
}

function r3fFiles(nodesRoot) {
  return readdirSync(nodesRoot, { recursive: true })
    .filter((path) => path.endsWith('.r3f.ts'))
    .map((path) => join(nodesRoot, path));
}

/**
 * Every node type a slice registers a component for, keyed by type. `intent` comes from the
 * `nodeComponentRegistry` call, or is `draws` for a Control registered only as a 2D-UI drawer.
 * `drawsOwnVisual` is true when any of its components is more than an invisible base.
 */
export function readRenderRegistrations(nodesRoot = NODES_ROOT) {
  const bases = invisibleBaseModules(nodesRoot);
  const registrations = new Map();
  for (const file of r3fFiles(nodesRoot)) {
    for (const call of parseRegistrationCalls(readFileSync(file, 'utf8'))) {
      const mountsBase =
        call.componentFrom !== null &&
        bases.has(resolve(dirname(file), call.componentFrom.replace(/\.js$/, '')));
      const typeNames = call.typeName !== null ? [call.typeName] : loopTypeNames(file, call.loopConstant);
      for (const type of typeNames) {
        const earlier = registrations.get(type);
        registrations.set(type, {
          type,
          file: call.registry === 'node' || !earlier ? file : earlier.file,
          intent: call.registry === 'node' ? call.intent : (earlier?.intent ?? 'draws'),
          scenePass: call.scenePass || earlier?.scenePass === true,
          drawsOwnVisual: !mountsBase || earlier?.drawsOwnVisual === true,
        });
      }
    }
  }
  return registrations;
}
