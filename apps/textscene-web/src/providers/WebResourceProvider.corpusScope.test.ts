/**
 * Corpus-scoped uploads: a file uploaded under corpus A is not served under another
 * corpus root. A corpus switch starts a new project, and an upload belongs to the
 * corpus active when it was added.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebResourceProvider } from './WebResourceProvider';

async function loadAsText(provider: WebResourceProvider, path: string): Promise<string> {
  const result = await provider.loadResource(path, 'Texture2D');
  expect(result).toBeInstanceOf(ArrayBuffer);
  return new TextDecoder().decode(new Uint8Array(result as ArrayBuffer));
}

describe('WebResourceProvider — corpus-scoped uploads', () => {
  let provider: WebResourceProvider;

  beforeEach(() => {
    provider = new WebResourceProvider();
    // Fixture fetches 404, so loadResource resolves only through an upload.
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
  });

  it('serves an uploaded file under the corpus root it was added with', async () => {
    provider.setResourceRoot('demos/2d/platformer');

    const file = new File(['content-A'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', file);

    const result = await provider.loadResource('res://textures/player.png', 'Texture2D');
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it('does NOT serve a file uploaded under a different corpus root', async () => {
    // Upload while corpus A is active
    provider.setResourceRoot('demos/2d/platformer');
    const file = new File(['content-A'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', file);

    // Switch to corpus B
    provider.setResourceRoot('demos/3d/fps');

    // The upload does not reach corpus B.
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');
  });

  it('serves the same res:// path if uploaded independently under the new corpus root', async () => {
    // Upload under corpus A
    provider.setResourceRoot('demos/2d/platformer');
    const fileA = new File(['content-A'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', fileA);

    // Switch to corpus B and upload a file at the same path
    provider.setResourceRoot('demos/3d/fps');
    const fileB = new File(['content-B'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', fileB);

    // Corpus B serves its own file
    expect(await loadAsText(provider, 'res://textures/player.png')).toBe('content-B');

    // Back in corpus A, it still serves its own file.
    provider.setResourceRoot('demos/2d/platformer');
    expect(await loadAsText(provider, 'res://textures/player.png')).toBe('content-A');
  });

  it('removeUploadedFile removes the path under EVERY corpus root (the uploaded-rows UI keys on the bare path and survives corpus switches)', async () => {
    // Upload under corpus A
    provider.setResourceRoot('demos/2d/platformer');
    const fileA = new File(['content-A'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', fileA);

    // Upload under corpus B
    provider.setResourceRoot('demos/3d/fps');
    const fileB = new File(['content-B'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', fileB);

    // Remove while corpus B is active
    const removed = provider.removeUploadedFile('res://textures/player.png');
    expect(removed).toBe(true);
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');

    // Back in corpus A, its copy is gone too: a removed path stays removed.
    provider.setResourceRoot('demos/2d/platformer');
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');
  });

  it('removeUploadedFile after a corpus switch still removes a file uploaded under the previous root', async () => {
    // Upload under the base ('') corpus, switch to a fixture corpus, then Remove:
    // the file goes.
    provider.setResourceRoot('');
    const file = new File(['content'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', file);

    provider.setResourceRoot('demos/2d/platformer');
    expect(provider.removeUploadedFile('res://textures/player.png')).toBe(true);

    provider.setResourceRoot('');
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');
  });

  it('an upload added under the empty root (fixture corpus) is not visible under a named corpus', async () => {
    // Upload with empty root (the base fixture corpus)
    provider.setResourceRoot('');
    const file = new File(['base-bytes'], 'icon.png', { type: 'image/png' });
    provider.addUploadedFile('res://art/icon.png', file);

    // Switch to a named corpus
    provider.setResourceRoot('demos/2d/platformer');
    await expect(
      provider.loadResource('res://art/icon.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');
  });
});
