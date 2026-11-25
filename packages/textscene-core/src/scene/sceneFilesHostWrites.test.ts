import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { SceneFailure, SceneFile } from './sceneFiles';
import { variant } from './variant';
import type { ResourceProvider } from '../resources/ResourceProvider';

const MAIN = 'res://main.tscn';
const TARGET = 'res://a.png';
const NESTED = 'res://n.tres';
const DEEPER = 'res://m.tres';
const OTHER = 'res://z.png';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

type TargetState = 'missing' | 'loading' | 'loaded';
/** Who reads the target besides the written node: no file, `n.tres`, or `n.tres` through `m.tres`. */
type NestedReader = 'none' | 'nested' | 'deeper';
/** `drop` sets the node's read to null, `replace` to another file, `add` writes a read the text lacks. */
type Write = 'drop' | 'replace' | 'add';
type Order = 'node first' | 'nested first';

interface Row {
  readonly target: TargetState;
  readonly reader: NestedReader;
  readonly order: Order;
  readonly write: Write;
}

interface Outcome {
  readonly failureChain: readonly string[] | null;
  /** The target's row in `scene.files()`, null where no live value reads it. */
  readonly targetRow: Pick<SceneFile, 'state' | 'owners'> | null;
  readonly listed: readonly string[];
}

const resourceReading = (path: string) =>
  `[gd_resource type="AtlasTexture" format=3]\n\n[resource]\natlas = Resource("${path}")\n`;

function sourceOf({ reader, order, write }: Row): string {
  const node = `[node name="A" type="Sprite2D" parent="."]\n${write === 'add' ? '' : `texture = Resource("${TARGET}")\n`}`;
  const nested = `[node name="N" type="Sprite2D" parent="."]\ntexture = Resource("${NESTED}")\n`;
  const children = reader === 'none' ? [node] : order === 'node first' ? [node, nested] : [nested, node];
  return ['[gd_scene format=3]\n', '[node name="Main" type="Node2D"]\n', ...children].join('\n');
}

function providerOf({ target, reader }: Row): ResourceProvider {
  const files: Record<string, string | ArrayBuffer> = { [OTHER]: PNG };
  if (target === 'loaded') files[TARGET] = PNG;
  if (reader === 'nested') files[NESTED] = resourceReading(TARGET);
  if (reader === 'deeper') {
    files[NESTED] = resourceReading(DEEPER);
    files[DEEPER] = resourceReading(TARGET);
  }
  return {
    loadResource: (path) =>
      target === 'loading' && path === TARGET ? new Promise(() => {}) : Promise.resolve(files[path] ?? null),
  };
}

/** The failure follows the file's text, and the files, owners and states follow the live values. */
function expectedOf({ target, reader, order, write }: Row): Outcome {
  const nestedChain =
    reader === 'none' ? [] : reader === 'nested' ? [NESTED, TARGET] : [NESTED, DEEPER, TARGET];
  const textReadsTarget = write !== 'add';
  const nestedOwner = reader === 'nested' ? NESTED : DEEPER;
  const owners = [...(write === 'add' ? [MAIN] : []), ...(reader === 'none' ? [] : [nestedOwner])];
  return {
    failureChain: target !== 'missing' ? null : failureChainOf(textReadsTarget, nestedChain, order),
    targetRow: owners.length === 0 ? null : { state: target, owners },
    listed: [
      ...(owners.length > 0 ? [TARGET] : []),
      ...(reader === 'deeper' ? [DEEPER] : []),
      ...(reader === 'none' ? [] : [NESTED]),
      ...(write === 'replace' ? [OTHER] : []),
    ].sort(),
  };
}

/** The first failing read in file order: the node's own read of the target, or the nested file's. */
function failureChainOf(textReadsTarget: boolean, nestedChain: readonly string[], order: Order) {
  if (textReadsTarget && (nestedChain.length === 0 || order === 'node first')) return [TARGET];
  return nestedChain.length > 0 ? nestedChain : null;
}

function outcomeOf(scene: Scene): Outcome {
  const files = scene.files();
  const target = files.find((file) => file.path === TARGET);
  const failure: SceneFailure | null = scene.sceneFailure();
  return {
    failureChain: failure?.chain ?? null,
    targetRow: target ? { state: target.state, owners: target.owners } : null,
    listed: files.map((file) => file.path).sort(),
  };
}

function writeOf(write: Write) {
  if (write === 'drop') return variant('null');
  return variant(`Resource("${write === 'replace' ? OTHER : TARGET}")`);
}

const ROWS: Row[] = (['missing', 'loading', 'loaded'] as const).flatMap((target) =>
  (['drop', 'replace', 'add'] as const).flatMap((write) =>
    (['none', 'nested', 'deeper'] as const).flatMap((reader) =>
      (reader === 'none' ? (['node first'] as const) : (['node first', 'nested first'] as const)).map(
        (order) => ({ target, reader, order, write })
      )
    )
  )
);

describe('a host write against the reads of the file on disk', () => {
  it.each(ROWS)('$write of a $target file, also read by $reader, $order', async (row) => {
    const scene = openScene({ source: sourceOf(row), provider: providerOf(row), rootScenePath: MAIN });
    const readsAnyFile = row.write !== 'add' || row.reader !== 'none';
    if (readsAnyFile) await expect.poll(() => scene.files().length > 0).toBe(true);

    await scene.getNode('A').set('texture', writeOf(row.write));

    await expect.poll(() => outcomeOf(scene), { timeout: 2000 }).toEqual(expectedOf(row));
  });
});
