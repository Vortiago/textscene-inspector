/** The loader's directory slot: a provider's listing of a `res://` folder, a missing folder, a provider that cannot list, and a changed file. */
import { describe, expect, it, vi } from 'vitest';
import { ResourceLoader } from './ResourceLoader';
import type { DirectoryEntry } from './projectListing';
import type { ResourceProvider } from './ResourceProvider';

const ENTRIES: readonly DirectoryEntry[] = [
  { name: 'a.png', isDirectory: false },
  { name: 'sub', isDirectory: true },
];

function loaderWith(provider: ResourceProvider): ResourceLoader {
  const loader = new ResourceLoader();
  loader.setProvider(provider);
  return loader;
}

const provider = (listDirectory?: ResourceProvider['listDirectory']): ResourceProvider => ({
  loadResource: async () => null,
  listDirectory,
});

describe('ResourceLoader.directories', () => {
  it('holds the entries the provider lists', async () => {
    const loader = loaderWith(provider(async () => ENTRIES));
    loader.directories.request('res://');
    await loader.eventBus.once('directory', 'loaded', 'res://');
    expect(loader.directories.getCached('res://')).toEqual({ kind: 'listed', entries: ENTRIES });
  });

  it('holds a missing folder as missing, not as a failure', async () => {
    const loader = loaderWith(provider(async () => null));
    loader.directories.request('res://nope');
    await loader.eventBus.once('directory', 'loaded', 'res://nope');
    expect(loader.directories.getCached('res://nope')).toEqual({ kind: 'missing' });
  });

  it('fails the request when the provider cannot list', async () => {
    const loader = loaderWith(provider());
    loader.directories.request('res://');
    await loader.eventBus.once('directory', 'failed', 'res://');
    expect(loader.directories.getCached('res://')).toBeNull();
  });

  it('lists a folder once however often it is requested', async () => {
    const list = vi.fn(async () => ENTRIES);
    const loader = loaderWith(provider(list));
    loader.directories.request('res://');
    loader.directories.request('res://');
    await loader.eventBus.once('directory', 'loaded', 'res://');
    loader.directories.request('res://');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps the listing of each folder above a changed file until its new listing arrives', async () => {
    const created: readonly DirectoryEntry[] = [...ENTRIES, { name: 'new.png', isDirectory: false }];
    let answer: readonly DirectoryEntry[] = ENTRIES;
    const list = vi.fn(async () => answer);
    const loader = loaderWith(provider(list));
    for (const folder of ['res://', 'res://a']) {
      loader.directories.request(folder);
      await loader.eventBus.once('directory', 'loaded', folder);
    }
    answer = created;

    loader.provideFile('res://a/new.png');

    expect(loader.directories.getCached('res://a')).toEqual({ kind: 'listed', entries: ENTRIES });
    await loader.eventBus.once('directory', 'loaded', 'res://a');
    expect(loader.directories.getCached('res://a')).toEqual({ kind: 'listed', entries: created });
  });

  it('lists again only the folders above a changed file that were listed before', async () => {
    const list = vi.fn(async () => ENTRIES);
    const loader = loaderWith(provider(list));
    loader.directories.request('res://b');
    await loader.eventBus.once('directory', 'loaded', 'res://b');
    list.mockClear();

    loader.provideFile('res://a/c.png');

    expect(list).not.toHaveBeenCalled();
  });
});
