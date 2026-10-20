/**
 * The render registrations the node slices declare in their `*.r3f.ts` files, read from source: the
 * types each one registers, its `renderIntent`, and whether its component draws or only mounts a base
 * that draws nothing. The badge reads the intent, so the guards hold the intent to the component.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { BASES, GEOMETRY_INSTANCE_BASE } from '../new-node-slice/bases.mjs';
import { importSourceOf } from '../new-node-slice/ancestry.mjs';
import { NODES_ROOT } from '../new-node-slice/paths.mjs';

/** A `nodeComponentRegistry` or `controlComponentRegistry` call, up to the `});` that closes it. */
const REGISTER_CALL = /\b(node|control)ComponentRegistry\.register\(\{([\s\S]*?)\}\);/g;

/**
 * The component modules of the bases a slice mounts to keep `visible` and the workspace split
 * while it draws nothing of its own. `Control` is not one: it lays out positioned divs.
 */
function invisibleBaseModules() {
  return new Set(
    [...Object.values(BASES), GEOMETRY_INSTANCE_BASE]
      .filter((base) => base.invisibleBase)
      .map((base) => join(NODES_ROOT, base.dir, 'Component'))
  );
}

/** A family loop over a type list, which registers each name in it. */
const TYPE_LOOP = /for \(const typeName of ([A-Z0-9_]+)\)/g;

/** The list the last family loop before `offset` iterates, or null when no loop precedes it. */
function loopConstantBefore(source, offset) {
  let constant = null;
  for (const loop of source.matchAll(TYPE_LOOP)) {
    if (loop.index > offset) break;
    constant = loop[1];
  }
  return constant;
}

/**
 * The `renderIntent` literal of one call body, or `draws` when the call declares none. A
 * shorthand or a constant throws, since reading it as `draws` would pass the guards unseen.
 */
function declaredIntent(body) {
  if (!/\brenderIntent\b/.test(body)) return 'draws';
  const literal = /renderIntent:\s*'([a-z-]+)'/.exec(body)?.[1];
  if (!literal) throw new Error(`expected renderIntent as a quoted literal, got: ${body.trim()}`);
  return literal;
}

/**
 * Each `register({...})` call in one `*.r3f.ts` source. `typeName` is null for a family loop,
 * whose `loopConstant` names the list its sibling `index.ts` exports. `componentFrom` is the
 * component's module specifier, or null for a component the file defines itself.
 */
export function parseRegistrationCalls(source) {
  return [...source.matchAll(REGISTER_CALL)].map(({ 1: registry, 2: body, index }) => {
    const component = /Component:\s*([A-Za-z0-9_]+)/.exec(body)?.[1];
    const typeName = /typeName:\s*'([A-Za-z0-9_]+)'/.exec(body)?.[1] ?? null;
    return {
      registry,
      typeName,
      loopConstant: typeName === null ? loopConstantBefore(source, index) : null,
      componentFrom: (component && importSourceOf(source, component)) ?? null,
      intent: declaredIntent(body),
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

function r3fFiles() {
  return readdirSync(NODES_ROOT, { recursive: true })
    .filter((path) => path.endsWith('.r3f.ts'))
    .map((path) => join(NODES_ROOT, path));
}

/**
 * Every node type a slice registers a component for, keyed by type. `intent` comes from the
 * `nodeComponentRegistry` call, or is `draws` for a Control registered only as a 2D-UI drawer.
 * `drawsOwnVisual` is true when any of its components is more than an invisible base.
 */
export function readRenderRegistrations() {
  const bases = invisibleBaseModules();
  const registrations = new Map();
  for (const file of r3fFiles()) {
    for (const call of parseRegistrationCalls(readFileSync(file, 'utf8'))) {
      const mountsBase =
        call.componentFrom !== null &&
        bases.has(resolve(dirname(file), call.componentFrom.replace(/\.js$/, '')));
      const typeNames = call.typeName !== null ? [call.typeName] : loopTypeNames(file, call.loopConstant);
      for (const type of typeNames) {
        const earlier = registrations.get(type);
        const isNode = call.registry === 'node';
        registrations.set(type, {
          type,
          file: isNode || !earlier ? file : earlier.file,
          intent: isNode ? call.intent : (earlier?.intent ?? 'draws'),
          scenePass: call.scenePass || earlier?.scenePass === true,
          drawsOwnVisual: !mountsBase || earlier?.drawsOwnVisual === true,
        });
      }
    }
  }
  return registrations;
}
