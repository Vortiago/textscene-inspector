// @vitest-environment node
import { Session } from 'node:inspector/promises';
import { setImmediate } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { SHADER_MODE } from '../materials/fogmaterial/shaderMode';
import { ENVIRONMENT } from '../environment/kind';
import { loaderServing } from '../testing/servingResourceLoader';
import { loaderSnapshots } from './loaderSnapshots';
import type { ResourceSnapshot } from './read';
import { sceneTables } from './reading.testkit';
import { nodeReference } from './scopedReference';

function readEnvironment(snapshot: ResourceSnapshot, id: string, sky = '') {
  const tables = sceneTables(`[sub_resource type="Environment" id="${id}"]\n${sky}`);
  const answer = snapshot.read(nodeReference(`SubResource("${id}")`, tables), ENVIRONMENT);
  if (answer.status !== 'loaded') throw new Error(`expected ${id} to load`);
  return { tables, answer };
}

function closedEnvironment(snapshot: ResourceSnapshot, id: string, sky: string) {
  const { tables, answer } = readEnvironment(snapshot, id, sky);
  return [new WeakRef(tables), new WeakRef(answer.value)];
}

async function collectGarbage() {
  const inspector = new Session();
  inspector.connect();
  try {
    await setImmediate();
    await inspector.post('HeapProfiler.collectGarbage');
  } finally {
    inspector.disconnect();
  }
}

it('releases closed Environments while another scene uses the same loader', async () => {
  const source = loaderSnapshots(loaderServing({}));
  const snapshot = source.current();
  const open = readEnvironment(snapshot, 'open', '');
  const closed = [
    ...closedEnvironment(snapshot, 'plain', ''),
    ...closedEnvironment(snapshot, 'with_sky', 'sky = SubResource("sky")'),
  ];
  await collectGarbage();

  for (const ref of closed) expect(ref.deref()).toBeUndefined();
  expect(source.current().read(nodeReference('SubResource("open")', open.tables), ENVIRONMENT)).toBe(
    open.answer
  );
});

it('reuses the public Environment value held across a reparse', async () => {
  const source = loaderSnapshots(loaderServing({}));
  const value = readEnvironment(source.current(), 'kept').answer.value;
  source.restart();
  await collectGarbage();

  expect(readEnvironment(source.current(), 'kept').answer.value).toBe(value);
});

it('reuses the Read of a primitive shader mode held across a reparse', async () => {
  const source = loaderSnapshots(loaderServing({}));
  const read = () => {
    const tables = sceneTables('[sub_resource type="VisualShader" id="shader"]\nmode = 4');
    return source.current().read(nodeReference('SubResource("shader")', tables), SHADER_MODE);
  };
  const first = read();
  source.restart();
  await collectGarbage();

  expect(first.value).toBe(4);
  expect(read()).toBe(first);
});
