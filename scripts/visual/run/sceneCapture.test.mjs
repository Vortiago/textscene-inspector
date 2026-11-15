/** The query a golden scene opens the previewer with. */
import { describe, expect, it } from 'vitest';
import { fixtureUrl } from '../preview/fixtureUrl.mjs';
import { sceneQuery } from './sceneCapture.mjs';

const SITE = 'http://127.0.0.1:4173';

describe('sceneQuery', () => {
  it('opens a node-only golden with the node lit surface', () => {
    const scene = { name: 'node-only', file: 'a.tscn', litSurface: 'nodes' };

    expect(fixtureUrl(SITE, scene.file, sceneQuery(scene))).toBe(`${SITE}/?fixture=a.tscn&litSurface=nodes`);
  });

  it('opens every other golden with no lit surface parameter', () => {
    const scene = { name: 'plain', file: 'a.tscn', camera: 'Camera3D' };

    expect(fixtureUrl(SITE, scene.file, sceneQuery(scene))).toBe(`${SITE}/?fixture=a.tscn&camera=Camera3D`);
  });
});
