import { describe, expect, it } from 'vitest';
import { sheetTargets } from './targets.mjs';

const sheet = (body) =>
  `---\ntype: Foo\nimage: unit-a\nfixture: unit-a.tscn\ncamera: Root/Camera3D\n---\n${body}`;
const cameraOf = (targets, image) => new Map(targets).get(image)?.camera;

describe('sheetTargets — the camera an image looks through', () => {
  it('gives an image the sheet camera by default', () => {
    const targets = sheetTargets(
      sheet('<!-- compare: image=unit-b status=done fixture=unit-b.tscn -->'),
      'foo.md'
    );
    expect(cameraOf(targets, 'unit-b')).toBe('Root/Camera3D');
  });

  it('takes a marker camera for its own image only', () => {
    const targets = sheetTargets(
      sheet('<!-- compare: image=unit-b status=done fixture=unit-b.tscn camera=B/Camera3D -->'),
      'foo.md'
    );
    expect(cameraOf(targets, 'unit-b')).toBe('B/Camera3D');
    expect(cameraOf(targets, 'unit-a')).toBe('Root/Camera3D');
  });
});
