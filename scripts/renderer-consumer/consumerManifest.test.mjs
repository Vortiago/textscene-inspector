import { describe, expect, it } from 'vitest';
import { consumerManifest } from './consumerManifest.mjs';

const manifest = consumerManifest({
  tarballs: { '@textscene/renderer': '/tmp/renderer.tgz' },
  peers: { react: '^19.3' },
  tools: { vite: '8.3.5' },
});

describe('consumerManifest', () => {
  it('installs each tarball by its file', () => {
    expect(manifest.dependencies['@textscene/renderer']).toBe('file:/tmp/renderer.tgz');
  });

  it('installs the peers at the range it is given', () => {
    expect(manifest.dependencies.react).toBe('^19.3');
  });

  it('keeps the build tools out of the dependencies', () => {
    expect(manifest.devDependencies).toEqual({ vite: '8.3.5' });
    expect(manifest.dependencies.vite).toBeUndefined();
  });

  it('is an ES module app with no workspace link', () => {
    expect(manifest).toMatchObject({ private: true, type: 'module' });
    expect(JSON.stringify(manifest)).not.toMatch(/workspace:|catalog:|link:/);
  });
});
