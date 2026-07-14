/**
 * Corpus-scoped uploads — app-shell integration (issue #264).
 *
 * Verifies Option A: a resource uploaded while corpus A is active is
 * scoped to that corpus.  When the provider switches to a different
 * corpus root the upload is no longer visible and a loadResource call for
 * the same path falls through (throws / fetches from fixtures).
 *
 * This test exercises the provider directly — mounting a full R3FApp is
 * not required because the corpus-switching mechanism (useCorpusRoot) is
 * already covered by its own unit tests, and addUploadedFile/loadResource
 * is a pure in-process call with no WebGL dependency.  What matters here
 * is that the *public* WebResourceProvider API honours the scoping
 * contract end-to-end (add → switch → load fails), without relying on
 * mocked internals or prototype call injection.
 */
import { describe, expect, it, vi } from 'vitest';
import { WebResourceProvider } from './providers/WebResourceProvider';

describe('#264 corpus-scoped uploads — provider contract', () => {
  it('upload added under corpus A is not served after switching to corpus B', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const provider = new WebResourceProvider();

    // Simulate: user is viewing a fixture in the base corpus (root = '').
    provider.setResourceRoot('');
    provider.addUploadedFile(
      'res://art/logo.png',
      new File(['corpus-A-bytes'], 'logo.png', { type: 'image/png' })
    );

    // The upload is visible while the same corpus root is active.
    const resultA = await provider.loadResource('res://art/logo.png', 'Texture2D');
    expect(resultA).toBeInstanceOf(ArrayBuffer);

    // Simulate: fixture switch to a vendored demo (useCorpusRoot calls
    // setResourceRoot with the new root before resources are requested).
    provider.setResourceRoot('demos/2d/platformer');

    // The upload from corpus '' must NOT bleed into corpus 'demos/2d/platformer'.
    await expect(
      provider.loadResource('res://art/logo.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');
  });

  it('switching back to the original corpus restores access to its upload', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const provider = new WebResourceProvider();

    provider.setResourceRoot('');
    provider.addUploadedFile(
      'res://textures/bg.png',
      new File(['original-bytes'], 'bg.png', { type: 'image/png' })
    );

    // Switch away.
    provider.setResourceRoot('demos/2d/platformer');
    await expect(
      provider.loadResource('res://textures/bg.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');

    // Switch back — upload is still there.
    provider.setResourceRoot('');
    const result = await provider.loadResource('res://textures/bg.png', 'Texture2D');
    expect(result).toBeInstanceOf(ArrayBuffer);
  });
});
