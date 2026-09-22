import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blankSceneText } from './sceneText.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('blankSceneText', () => {
  it('empties every text assignment and counts them', () => {
    const source = [
      '[node name="A" type="Label"]',
      'text = "Centered label"',
      '[node name="B" type="Label"]',
      'text = "shouts when rendered"',
      'uppercase = true',
    ].join('\n');

    const result = blankSceneText(source);

    expect(result.replacements).toBe(2);
    expect(result.source).toBe(
      [
        '[node name="A" type="Label"]',
        'text = ""',
        '[node name="B" type="Label"]',
        'text = ""',
        'uppercase = true',
      ].join('\n'),
    );
  });

  it('reports zero replacements for a scene with no text', () => {
    const source = '[node name="Root" type="Control"]\nanchors_preset = 15\n';

    expect(blankSceneText(source)).toEqual({ source, replacements: 0 });
  });

  it('leaves an embedded escaped quote intact and does not run past the value', () => {
    const source = 'text = "say \\"hi\\""\nhorizontal_alignment = 1\n';

    const result = blankSceneText(source);

    expect(result.replacements).toBe(1);
    expect(result.source).toBe('text = ""\nhorizontal_alignment = 1\n');
  });

  it('ignores a text substring that is not its own assignment', () => {
    const source = 'autowrap_mode = 3\ntooltip_text = "keep me"\n';

    expect(blankSceneText(source).replacements).toBe(0);
  });

  it('blanks every label in the fixture the gate drives', () => {
    const fixture = readFileSync(
      path.join(REPO_ROOT, 'scenes/fixtures/unit-label-2d.tscn'),
      'utf8',
    );

    const result = blankSceneText(fixture);

    expect(result.replacements).toBeGreaterThan(0);
    expect(result.source).not.toMatch(/text = "[^"]/);
  });
});
