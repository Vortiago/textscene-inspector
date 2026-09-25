/**
 * The NodePath slot validator. `variant.cpp:746-749` converts `{ STRING, NIL }`
 * into a NODE_PATH and `Variant::operator NodePath()` (`:2001`) builds it, so
 * `remote_path = "../Body"` equals `NodePath("../Body")`. A StringName stays a
 * format error.
 */

import { describe, expect, it } from 'vitest';
import { createNodePathValidator, createResourceReferenceValidator } from './resourceValidators.js';
import '../index.js';
import { lint, node, scene, expectNoDiagnostic } from '../testing/testkit';
import { TscnParser } from '../../parser/TscnParser.js';
import { resolveResourceSlot } from '../resourceChecker.js';

const validator = createNodePathValidator('remote_path');

describe('createNodePathValidator', () => {
  it('accepts the NodePath literal and the bare string the slot converts', () => {
    expect(validator('remote_path', 'NodePath("../Body")', 1)).toBeNull();
    expect(validator('remote_path', '"../Body"', 1)).toBeNull();
    expect(validator('remote_path', '""', 1)).toBeNull();
  });

  it('rejects a StringName and a bare word', () => {
    expect(validator('remote_path', '&"Body"', 1)).not.toBeNull();
    expect(validator('remote_path', 'Body', 1)).not.toBeNull();
  });
});

describe('a bare-string NodePath through the linter', () => {
  it('validates and resolves the same as the NodePath spelling', () => {
    const content = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('RemoteTransform2D', { remote_path: '"Target"' }, { name: 'Relay', parent: '.' }),
      node('Sprite2D', {}, { name: 'Target', parent: 'Relay' })
    );
    expectNoDiagnostic(content, { prop: 'remote_path' });
    expectNoDiagnostic(content, { ruleName: 'remotetransform2d-invalid-remote-path' });
  });
});

/**
 * The old-style integer index: `_parse_ext_resource` and `_parse_sub_resource`
 * take TK_NUMBER as well as TK_STRING (`resource_format_text.cpp:107,128`) and
 * stringify it, as the header's `next_tag.fields["id"]` is (`:488`, `:1048`), so
 * `id=1` and `ExtResource(1)` meet as the string "1" and the file loads.
 */
describe('a resource slot holding an integer index', () => {
  const validator = createResourceReferenceValidator('texture');

  it('passes the format check', () => {
    expect(validator('texture', 'ExtResource(1)', 1)).toBeNull();
    expect(validator('texture', 'SubResource(3)', 1)).toBeNull();
  });

  it('resolves an ext-resource declared with an unquoted header id', () => {
    const content = scene(
      '[ext_resource type="Texture2D" path="res://a.png" id=1]',
      node('Sprite2D', { texture: 'ExtResource(1)' })
    );
    expect(lint(content)).toEqual([]);
    const parsed = new TscnParser().parse(content);
    expect(parsed.externalResources?.[0]?.id).toBe('1');
    expect(resolveResourceSlot(parsed, 'ExtResource(1)')).toEqual({ kind: 'resolved', type: 'Texture2D' });
  });

  it('resolves a sub-resource declared with an unquoted header id', () => {
    const content = scene(
      '[sub_resource type="RectangleShape2D" id=3]',
      node('StaticBody2D'),
      node('CollisionShape2D', { shape: 'SubResource(3)' }, { parent: '.' })
    );
    expect(lint(content)).toEqual([]);
    const parsed = new TscnParser().parse(content);
    expect(parsed.internalResources?.[0]?.id).toBe('3');
    expect(resolveResourceSlot(parsed, 'SubResource(3)')).toEqual({ kind: 'resolved', type: 'RectangleShape2D' });
  });
});
