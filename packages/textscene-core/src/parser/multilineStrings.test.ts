/**
 * Godot writes a multi-line string value across several lines inside one pair of
 * quotes. The line-based parser rejoins them, rather than keeping a first fragment
 * such as `"Field Notes`.
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
    expect((title?.properties as Record<string, unknown> | undefined)?.text).toBe(
      'Field Notes\nVolume Two'
    );
  });

  it('keeps parsing the property that follows the multi-line string', () => {
    const scene = new TscnParser().parse(MULTILINE);
    const title = find(scene.nodes, 'Title');
    // horizontal_alignment sits after the closing quote line, outside the string.
    expect(
      (title?.properties as Record<string, unknown> | undefined)?.horizontalAlignment
    ).toBe(1);
  });

  it('joins a CRLF multi-line string without leaving stray carriage returns', () => {
    // Windows-authored .tscn (CRLF line endings on checkout).
    const crlf = MULTILINE.replace(/\n/g, '\r\n');
    const scene = new TscnParser().parse(crlf);
    const title = find(scene.nodes, 'Title');
    expect((title?.properties as Record<string, unknown> | undefined)?.text).toBe(
      'Field Notes\nVolume Two'
    );
  });

  it('decodes escape sequences in single-line strings (\\n → newline)', () => {
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[node name="B" type="Button"]\ntext = "OK\\nCancel"\n`
    );
    const button = find(scene.nodes, 'B');
    expect((button?.properties as Record<string, unknown> | undefined)?.text).toBe(
      'OK\nCancel'
    );
  });

  it('leaves single-line strings untouched', () => {
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[node name="L" type="Label"]\ntext = "Just one line"\n`
    );
    const label = find(scene.nodes, 'L');
    expect((label?.properties as Record<string, unknown> | undefined)?.text).toBe(
      'Just one line'
    );
  });

  it('salvages an unclosed string that runs into the next node (no swallow)', () => {
    // Malformed: A's string never closes; B (a child) must still parse rather
    // than being consumed as string content.
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[node name="A" type="Label"]\ntext = "oops unclosed\n[node name="B" type="Label" parent="."]\ntext = "fine"\n`
    );
    const b = find(scene.nodes, 'B');
    expect((b?.properties as Record<string, unknown> | undefined)?.text).toBe('fine');
  });

  // BBCode tags such as `[u]…[/u]` and `[center]` on their own lines look like
  // headings but are string content. Only a real section heading may trigger the
  // salvage, or the value truncates and the next property is dropped.
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
      const title = find(scene.nodes, 'Title');
      expect((title?.properties as Record<string, unknown> | undefined)?.text).toBe(
        '[center]Line A\n[b]bold[/b]\n\n[u]Section[/u]\n- item'
      );
    });

    it('still parses the property after the BBCode multi-line string', () => {
      const scene = new TscnParser().parse(BBCODE);
      const title = find(scene.nodes, 'Title');
      expect(
        (title?.properties as Record<string, unknown> | undefined)?.horizontalAlignment
      ).toBe(1);
    });
  });
});
