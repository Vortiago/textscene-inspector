/**
 * Corpus-scoped uploads: a file uploaded while corpus A is active must NOT be
 * served when the provider has been switched to a different corpus root.
 * Switching corpora is the "start a new project" boundary — the user's own
 * uploads belong to whichever corpus was active when they added them, never
 * to a foreign corpus that happens to share the same res:// path.
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
    // Fixture fetches 404 so loadResource resolves only via an upload.
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

    // The upload must NOT bleed into corpus B
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

    // Switch back — corpus A still serves its own file
    provider.setResourceRoot('demos/2d/platformer');
    expect(await loadAsText(provider, 'res://textures/player.png')).toBe('content-A');
  });

  it('removeUploadedFile removes only the file under the active corpus root', async () => {
    // Upload under corpus A
    provider.setResourceRoot('demos/2d/platformer');
    const fileA = new File(['content-A'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', fileA);

    // Upload under corpus B
    provider.setResourceRoot('demos/3d/fps');
    const fileB = new File(['content-B'], 'player.png', { type: 'image/png' });
    provider.addUploadedFile('res://textures/player.png', fileB);

    // Remove from corpus B
    const removed = provider.removeUploadedFile('res://textures/player.png');
    expect(removed).toBe(true);
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');

    // Switch back — corpus A's file must still be there
    provider.setResourceRoot('demos/2d/platformer');
    const resultA = await provider.loadResource('res://textures/player.png', 'Texture2D');
    expect(resultA).toBeInstanceOf(ArrayBuffer);
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
