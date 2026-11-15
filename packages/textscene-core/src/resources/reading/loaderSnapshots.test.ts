/**
 * Snapshots over a real loader: a read that waits on a file, the identity of a value across
 * snapshots, and what a reload of a file renews.
 */

import { describe, expect, it, vi } from 'vitest';
import { ResourceLoader } from '../ResourceLoader';
import { busServing } from '../testing/servingFileBus';
import { loaderServing } from '../testing/servingResourceLoader';
import { FONT_FILES } from '../fileKinds';
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

  it('answers each address into a loaded file with the file, or null for an id it does not declare', async () => {
    const loader = loaderServing({ [A_FILE]: resourceFile('', '[sub_resource type="Resource" id="here"]') });
    await loaded(loader, A_FILE);
    const source = loaderSnapshots(loader);
    const { kind } = namedKind();
    const read = (path: string) => source.current().read(nodeReference(path, sceneTables('')), kind);
    read(`${A_FILE}::here`);
    read(`${A_FILE}::gone`);

    const files = source.files();

    expect(files.get(`${A_FILE}::here`)).toBe(files.get(A_FILE));
    expect(files.get(`${A_FILE}::gone`)).toBeNull();
  });
});

describe('a snapshot of a file Godot fails to load', () => {
  const FAILING_A = resourceFile(
    'texture = ExtResource("1_gone")',
    '[ext_resource type="Texture2D" path="res://gone.png" id="1_gone"]'
  );

  async function readOnceSettled(loader: ResourceLoader) {
    const source = loaderSnapshots(loader);
    const unsubscribe = source.subscribe(() => {});
    const read = () =>
      source.current().read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), namedKind().kind);
    read();
    source.request();
    await vi.waitFor(() => expect(loader.loadOutcomes.getCached(A_FILE)).toBeDefined());
    const settled = read();
    unsubscribe();
    return { settled, files: source.files() };
  }

  it('reads a .tres whose [resource] reads a missing file as missing-file', async () => {
    const loader = loaderServing({ [A_FILE]: FAILING_A });
    await loaded(loader, A_FILE);

    const { settled } = await readOnceSettled(loader);

    expect(settled).toMatchObject({ status: 'unavailable', reason: 'missing-file' });
  });

  it('reports the .tres as missing', async () => {
    const loader = loaderServing({ [A_FILE]: FAILING_A });
    await loaded(loader, A_FILE);

    const { files } = await readOnceSettled(loader);

    expect(files.get(A_FILE)).toBeNull();
  });

  it('reads the .tres once the file it reads exists', async () => {
    const loader = loaderServing({ [A_FILE]: FAILING_A, 'res://gone.png': '' });
    await loaded(loader, A_FILE);

    const { settled, files } = await readOnceSettled(loader);

    expect(settled.status).toBe('loaded');
    expect(files.get(A_FILE)).not.toBeNull();
  });
});

describe("a snapshot's read of a processor's value", () => {
  const FONT_FILE = 'res://font.tres';
  const FONT_TEXT =
    '[gd_resource type="SystemFont" format=3]\n\n[resource]\nfont_names = PackedStringArray("Serif")\n';

  it('requests the file from the cache of its kind, not from the resource files', () => {
    const loader = loaderServing({ [FONT_FILE]: FONT_TEXT });
    const source = loaderSnapshots(loader);

    expect(source.current().loaded(FONT_FILES, FONT_FILE).status).toBe('pending');
    source.request();

    expect(loader.fonts.isLoading(FONT_FILE) || loader.fonts.getCached(FONT_FILE) !== undefined).toBe(true);
    expect(loader.resources.getCached(FONT_FILE)).toBeUndefined();
  });

  it('goes stale on a load on the bus of its kind, and answers the value', async () => {
    const loader = loaderServing({ [FONT_FILE]: FONT_TEXT });
    const source = loaderSnapshots(loader);
    let staleCount = 0;
    const unsubscribe = source.subscribe(() => staleCount++);
    source.current().loaded(FONT_FILES, FONT_FILE);
    source.request();

    await nextTick();
    await nextTick();

    expect(staleCount).toBeGreaterThan(0);
    expect(source.current().loaded(FONT_FILES, FONT_FILE)).toMatchObject({
      status: 'loaded',
      value: { kind: 'system', fontNames: ['Serif'] },
    });
    unsubscribe();
  });

  it('lists a failed file for the Missing resource report', async () => {
    const loader = loaderServing({});
    const source = loaderSnapshots(loader);
    const unsubscribe = source.subscribe(() => {});
    source.current().loaded(FONT_FILES, FONT_FILE);
    source.request();
    await nextTick();
    await nextTick();

    source.current().loaded(FONT_FILES, FONT_FILE);

    expect(source.files().get(FONT_FILE)).toBeNull();
    unsubscribe();
  });

  it('keeps a file pinned across a new snapshot that has not read it yet', async () => {
    const loader = loaderServing({ [A_FILE]: resourceFile('') });
    const source = loaderSnapshots(loader);
    const unsubscribe = source.subscribe(() => {});
    source.current().read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), namedKind().kind);
    source.request();
    const unpin = vi.spyOn(loader.resources, 'unpin');

    source.restart();
    source.request();

    expect(unpin).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('unpins a file one snapshot after its last read', async () => {
    const loader = loaderServing({ [A_FILE]: resourceFile('') });
    const source = loaderSnapshots(loader);
    const unsubscribe = source.subscribe(() => {});
    source.current().read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), namedKind().kind);
    source.request();
    const unpin = vi.spyOn(loader.resources, 'unpin');

    source.restart();
    source.restart();
    source.request();

    expect(unpin).toHaveBeenCalledWith(A_FILE);
    unsubscribe();
  });
});
