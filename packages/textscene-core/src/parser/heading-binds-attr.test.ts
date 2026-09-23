/**
 * The one attribute Godot writes with a space after its `=`: `" binds= " + vars`
 * (`scene/resources/resource_format_text.cpp`), an Array that opens with `[`. The `[`
 * decides, not the space: heading-value-scan.test.ts pins `type= parent="Foo"`, so
 * skipping whitespace always fails there and never skipping it fails here.
 */

import { describe, it, expect } from 'vitest';
import { parseHeading } from './utils';

describe('parseHeading captures the space-after-= binds attribute', () => {
  it('captures binds as Godot writes it', () => {
    // scene/resources/resource_format_text.cpp: f->store_string(" binds= " + vars)
    const result = parseHeading(
      '[connection signal="ready" from="Child" to="." method="_on_my_sig" binds= [7, "hi"]]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes.binds).toBe('[7, "hi"]');
    expect(Object.keys(result!.attributes).sort()).toEqual([
      'binds',
      'from',
      'method',
      'signal',
      'to',
    ]);
  });

  it('does not let a bind element containing "=" fabricate a key', () => {
    const result = parseHeading(
      '[connection signal="pressed" from="B" to="." method="_on_p" binds= ["x=1"]]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes.binds).toBe('["x=1"]');
    expect(Object.keys(result!.attributes).sort()).toEqual([
      'binds',
      'from',
      'method',
      'signal',
      'to',
    ]);
  });

  it('keeps a following attribute separate from the bracketed value', () => {
    const result = parseHeading('[connection binds= [1, 2] unbinds=1 flags=3]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ binds: '[1, 2]', unbinds: '1', flags: '3' });
  });

  it('still drops a valueless key whose next token is another attribute', () => {
    // The other side of the fork: `p`, not `[`, follows the space.
    const result = parseHeading('[node name="X" type= parent="Foo" index="2"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: 'Foo', index: '2' });
  });

  it('drops a valueless key at the end of the heading', () => {
    const result = parseHeading('[node name="X" type= ]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X' });
  });
});
