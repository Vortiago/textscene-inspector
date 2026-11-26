import { describe, expect, it } from 'vitest';
import { fixtureUrl } from '../preview/fixtureUrl.mjs';
import { sceneQuery, slowCanvasLine } from './sceneCapture.mjs';

const SITE = 'http://127.0.0.1:4173';

describe('sceneQuery', () => {
  it('opens a node-only golden with the node lit surface', () => {
    const scene = { name: 'node-only', file: 'a.tscn', litSurface: 'nodes' };

    expect(fixtureUrl(SITE, scene.file, sceneQuery(scene))).toBe(`${SITE}/?fixture=a.tscn&litSurface=nodes`);
  });

  it('opens a translated-only golden with the translated canvas item', () => {
    const scene = { name: 'translated-only', file: 'a.tscn', canvasItem: 'translated' };

    expect(fixtureUrl(SITE, scene.file, sceneQuery(scene))).toBe(
      `${SITE}/?fixture=a.tscn&canvasItem=translated`
    );
  });

  it('opens every other golden with no lit surface parameter', () => {
    const scene = { name: 'plain', file: 'a.tscn', camera: 'Camera3D' };

    expect(fixtureUrl(SITE, scene.file, sceneQuery(scene))).toBe(`${SITE}/?fixture=a.tscn&camera=Camera3D`);
  });
});

describe('slowCanvasLine', () => {
  it('logs no line for an open under ten seconds', () => {
    expect(slowCanvasLine('quick', 9999)).toBeNull();
  });

  it('logs a slow open with its share of the canvas wait', () => {
    expect(slowCanvasLine('lit', 54000)).toBe(
      '[visual]   lit: opened in 54.0 s, 60 % of the 90 s canvas wait'
    );
  });
});
