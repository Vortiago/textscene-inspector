/**
 * Snapshots over a real loader: a read that waits on a file, the identity of a value across
 * snapshots, and what a reload of a file renews.
 */

import { describe, expect, it } from 'vitest';
import { ResourceLoader } from '../ResourceLoader';
import { busServing } from '../testing/servingFileBus';
import { loaderServing } from '../testing/servingResourceLoader';
import { loaderSnapshots } from './loaderSnapshots';
import type { Read } from './read';
import { nodeReference } from './scopedReference';
import { namedKind, resourceFile, sceneTables, type Named } from './reading.testkit';

const A_FILE = 'res://a.tres';
const B_FILE = 'res://b.tres';
const EXT_A = `[ext_resource type="Resource" path="${A_FILE}" id="1_a"]`;
const EXT_B = `[ext_resource type="Resource" path="${B_FILE}" id="1_b"]`;

/** Lets a file read through the bus finish. */
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve));

async function loaded(loader: ResourceLoader, ...paths: string[]): Promise<void> {
  paths.forEach((path) => loader.resources.request(path));
  await nextTick();
}

describe('a snapshot over the loader', () => {
  it('answers pending for a resource whose nested read waits on a file', async () => {
    const loader = loaderServing(
      { [A_FILE]: resourceFile('next = ExtResource("1_b")', EXT_B), [B_FILE]: resourceFile('') },
      [B_FILE]
    );
    await loaded(loader, A_FILE);

    const read = loaderSnapshots(loader)
      .current()
      .read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), namedKind().kind);

    expect(read.status).toBe('pending');
  });

  it('keeps the snapshot, and the value, while no file it read changes', async () => {
    const loader = loaderServing({
      [A_FILE]: resourceFile('resource_name = "a"'),
      [B_FILE]: resourceFile(''),
    });
    await loaded(loader, A_FILE);
    const source = loaderSnapshots(loader);
    const { kind } = namedKind();
    const read = () =>
      source.current().read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), kind).value;
    const first = read();
    const snapshot = source.current();

    await loaded(loader, B_FILE);

    expect(source.current()).toBe(snapshot);
    expect(read()).toBe(first);
  });

  it('gives a new value to each decode that read a reloaded file, and to no other', async () => {
    const { bus, provider, files } = busServing({
      [A_FILE]: resourceFile('resource_name = "a"'),
      [B_FILE]: resourceFile('resource_name = "b"'),
    });
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);
    await loaded(loader, A_FILE, B_FILE);
    const { kind } = namedKind();
    const scene = sceneTables(`${EXT_A}\n${EXT_B}`);
    const read = (ref: string): Read<Named> =>
      loaderSnapshots(loader).current().read(nodeReference(ref, scene), kind);
    const [a, b] = [read('ExtResource("1_a")').value, read('ExtResource("1_b")').value];

    files[A_FILE] = resourceFile('resource_name = "a"');
    loader.resources.clearCache(A_FILE);
    await loaded(loader, A_FILE);

    expect(read('ExtResource("1_a")').value).not.toBe(a);
    expect(read('ExtResource("1_b")').value).toBe(b);
  });

  it('runs again for a reload of a file it read, and keeps the last answer while the file reloads', async () => {
    const loader = loaderServing({ [A_FILE]: resourceFile('resource_name = "a"') });
    await loaded(loader, A_FILE);
    const source = loaderSnapshots(loader);
    const { kind } = namedKind();
    const read = () => source.current().read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), kind);
    let stale = 0;
    source.subscribe(() => stale++);
    read();

    loader.resources.clearCache(A_FILE);
    const whileReloading = read().status;
    await nextTick();

    expect(whileReloading).toBe('loaded');
    expect(stale).toBeGreaterThan(0);
  });
});
