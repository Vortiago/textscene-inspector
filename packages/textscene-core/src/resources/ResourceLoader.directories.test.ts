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

  it('drops the listing of every folder above a file that changed', async () => {
    const loader = loaderWith(provider(async () => ENTRIES));
    for (const folder of ['res://', 'res://a', 'res://b']) {
      loader.directories.request(folder);
      await loader.eventBus.once('directory', 'loaded', folder);
    }
    loader.provideFile('res://a/c.png');
    expect(loader.directories.getCached('res://')).toBeUndefined();
    expect(loader.directories.getCached('res://a')).toBeUndefined();
    expect(loader.directories.getCached('res://b')).not.toBeUndefined();
  });
});
