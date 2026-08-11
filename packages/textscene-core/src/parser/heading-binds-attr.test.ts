/**
 * Contract: the ONE attribute Godot's writer emits with a space after its `=`.
 *
 * `scene/resources/resource_format_text.cpp` writes every connection attribute
 * as `key=value` with no space — `unbinds=`, `to_uid_path=`, `signal=` — except
 * the bound-argument list, which is written as `" binds= " + vars` where `vars`
 * is `VariantWriter::write_to_string` of an `Array` and therefore always starts
 * with `[`. A scanner that stops at the `=` drops `binds` entirely and then
 * re-reads its elements as keyless tokens.
 *
 * The discriminating rule is that leading `[`, not the space: a heading may also
 * carry a key whose value is genuinely absent (`type= parent="Foo"`), and there
 * the token after the space is another `key=value` pair that must stay its own
 * attribute. heading-value-scan.test.ts pins that case; this file pins the other
 * side of the same fork, so a fix that skips whitespace unconditionally fails
 * there and a fix that never skips it fails here.
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
    // The other side of the fork — `p`, not `[`, follows the space.
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
