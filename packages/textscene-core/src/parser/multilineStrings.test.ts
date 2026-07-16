/**
 * Godot writes multi-line string values (label text, descriptions) across
 * several physical lines inside one pair of quotes. The line-based property
 * parser must rejoin them rather than keeping only the first fragment (which
 * left a stray leading quote and dropped the rest — visible as a truncated
 * two-line title collapsing to `"Field Notes`).
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from './TscnParser';
import type { TscnNode } from './types';

function find(nodes: readonly TscnNode[], name: string): TscnNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = find(n.children, name);
    if (hit) return hit;
  }
  return undefined;
}

describe('multi-line quoted string property values', () => {
  const MULTILINE = `[gd_scene format=3]

[node name="Title" type="Label"]
text = "Field Notes
Volume Two"
horizontal_alignment = 1
`;

  it('rejoins a multi-line Label text into one unquoted value', () => {
    const scene = new TscnParser().parse(MULTILINE);
    const title = find(scene.nodes, 'Title');
    expect(title?.properties.text).toBe('Field Notes\nVolume Two');
  });

  it('keeps parsing the property that follows the multi-line string', () => {
    const scene = new TscnParser().parse(MULTILINE);
    const title = find(scene.nodes, 'Title');
    // horizontal_alignment sits AFTER the closing quote line — it must not be
    // swallowed into the string.
    expect(title?.properties.horizontalAlignment).toBe(1);
  });

  it('joins a CRLF multi-line string without leaving stray carriage returns', () => {
    // Windows-authored .tscn (CRLF line endings on checkout).
    const crlf = MULTILINE.replace(/\n/g, '\r\n');
    const scene = new TscnParser().parse(crlf);
    expect(find(scene.nodes, 'Title')?.properties.text).toBe(
      'Field Notes\nVolume Two'
    );
  });

  it('decodes escape sequences in single-line strings (\\n → newline)', () => {
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[node name="B" type="Button"]\ntext = "OK\\nCancel"\n`
    );
    expect(find(scene.nodes, 'B')?.properties.text).toBe('OK\nCancel');
  });

  it('leaves single-line strings untouched', () => {
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[node name="L" type="Label"]\ntext = "Just one line"\n`
    );
    expect(find(scene.nodes, 'L')?.properties.text).toBe('Just one line');
  });

  it('salvages an unclosed string that runs into the next node (no swallow)', () => {
    // Malformed: A's string never closes; B (a child) must still parse rather
    // than being consumed as string content.
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[node name="A" type="Label"]\ntext = "oops unclosed\n[node name="B" type="Label" parent="."]\ntext = "fine"\n`
    );
    expect(find(scene.nodes, 'B')?.properties.text).toBe('fine');
  });

  // A RichTextLabel's BBCode `text` puts tags like `[u]…[/u]` / `[center]` on
  // their own lines — these look like section headings (start with `[`, end with
  // `]`) but are string CONTENT, not a new section. The salvage trigger must
  // recognise only real section headings, or the value truncates at the first
  // such line and the next property is dropped (the Credits.tscn bug).
  describe('BBCode tag lines inside a multi-line string', () => {
    const BBCODE = `[gd_scene format=3]

[node name="Title" type="Label"]
text = "[center]Line A
[b]bold[/b]

[u]Section[/u]
- item"
horizontal_alignment = 1
`;

    it('keeps the full value past BBCode-tag lines and a blank line', () => {
      const scene = new TscnParser().parse(BBCODE);
      expect(find(scene.nodes, 'Title')?.properties.text).toBe(
        '[center]Line A\n[b]bold[/b]\n\n[u]Section[/u]\n- item'
      );
    });

    it('still parses the property after the BBCode multi-line string', () => {
      const scene = new TscnParser().parse(BBCODE);
      expect(find(scene.nodes, 'Title')?.properties.horizontalAlignment).toBe(1);
    });
  });
});
