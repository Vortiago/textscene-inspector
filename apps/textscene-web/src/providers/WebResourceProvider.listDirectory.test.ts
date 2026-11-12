/**
 * `WebResourceProvider.listDirectory`: the folders of the fixtures mirror (`fixtures-listing.json`) under the active corpus root,
 * with the files uploaded to it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebResourceProvider } from './WebResourceProvider';

const LISTING = {
  '': ['sub/', 'a.png'],
  sub: ['deep/', 'b.png'],
  'sub/deep': [],
  'demos/2d/platformer': ['player.tscn', 'art/'],
  'demos/2d/platformer/art': ['hero.png'],
};

const answerWith = (body: unknown, contentType = 'application/json') =>
  vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => contentType },
    json: async () => body,
  });

describe('WebResourceProvider listDirectory', () => {
  let provider: WebResourceProvider;

  beforeEach(() => {
    global.fetch = answerWith(LISTING) as unknown as typeof fetch;
    provider = new WebResourceProvider();
  });

  it('lists the root of the mirror', async () => {
    expect(await provider.listDirectory('res://')).toEqual([
      { name: 'sub', isDirectory: true },
      { name: 'a.png', isDirectory: false },
    ]);
  });

  it('lists a folder, and an empty one', async () => {
    expect((await provider.listDirectory('res://sub'))?.map(({ name }) => name)).toEqual(['deep', 'b.png']);
    expect(await provider.listDirectory('res://sub/deep')).toEqual([]);
  });

  it('answers null for a folder the mirror lacks', async () => {
    expect(await provider.listDirectory('res://nope')).toBeNull();
  });

  it('lists under the active corpus root', async () => {
    provider.setResourceRoot('demos/2d/platformer');
    expect((await provider.listDirectory('res://'))?.map(({ name }) => name)).toEqual(['player.tscn', 'art']);
    expect((await provider.listDirectory('res://art'))?.map(({ name }) => name)).toEqual(['hero.png']);
  });

  it('fetches the listing once', async () => {
    await provider.listDirectory('res://');
    await provider.listDirectory('res://sub');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/fixtures-listing.json');
  });

  it('adds an uploaded file to its folder, and the folders above it', async () => {
    provider.addUploadedFile('res://sub/c.png', new File([''], 'c.png'));
    provider.addUploadedFile('res://new/inner/d.png', new File([''], 'd.png'));
    expect((await provider.listDirectory('res://sub'))?.map(({ name }) => name)).toEqual([
      'deep',
      'b.png',
      'c.png',
    ]);
    expect((await provider.listDirectory('res://'))?.map(({ name }) => name)).toEqual([
      'sub',
      'a.png',
      'new',
    ]);
    expect(await provider.listDirectory('res://new/inner')).toEqual([{ name: 'd.png', isDirectory: false }]);
  });

  it('lists an uploaded file once when the mirror holds it too', async () => {
    provider.addUploadedFile('res://a.png', new File([''], 'a.png'));
    const names = (await provider.listDirectory('res://'))!.map(({ name }) => name);
    expect(names.filter((name) => name === 'a.png')).toHaveLength(1);
  });

  it('answers null without a mirror and without an upload to the folder', async () => {
    const bare = new WebResourceProvider({ hasFixturesMirror: false });
    expect(await bare.listDirectory('res://')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('lists the uploads alone without a mirror', async () => {
    const bare = new WebResourceProvider({ hasFixturesMirror: false });
    bare.addUploadedFile('res://x.png', new File([''], 'x.png'));
    expect(await bare.listDirectory('res://')).toEqual([{ name: 'x.png', isDirectory: false }]);
  });

  it('treats an HTML answer, the SPA fallback of a missing file, as no listing', async () => {
    global.fetch = answerWith('<html>', 'text/html') as unknown as typeof fetch;
    expect(await new WebResourceProvider().listDirectory('res://')).toBeNull();
  });

  it('treats a refused fetch as no listing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await new WebResourceProvider().listDirectory('res://')).toBeNull();
  });
});
