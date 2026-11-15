/**
 * The check a property descriptor implies, one case per Variant type and per hint the capture
 * holds. Each row is a real capture row of a class with no hand validator, so the case shows what
 * the linter now says about that class.
 */

import { describe, expect, it } from 'vitest';
import { descriptorValidator } from './descriptorValidator.js';
import { propertyDescriptor, type PropertyDescriptor } from '../godot/classdb/propertyDescriptor.js';
import { expectAccepted, expectError, expectWarning } from './testing/validatorCheck.js';
import type { PropertyValidator } from './propertyValidator.js';

function descriptorOf(className: string, key: string): PropertyDescriptor {
  const descriptor = propertyDescriptor(className, key);
  expect(descriptor, `no capture row for ${className}.${key}`).toBeDefined();
  return descriptor!;
}

function validatorOf(className: string, key: string): PropertyValidator {
  const validator = descriptorValidator(descriptorOf(className, key));
  expect(validator, `no derived check for ${className}.${key}`).not.toBeNull();
  return validator!;
}

function check(className: string, key: string, value: string) {
  return validatorOf(className, key)(key, value, 1);
}

describe('the format check the Variant type picks', () => {
  it.each([
    ['BOOL', 'EditorDock', 'closable', 'true', 'maybe'],
    ['INT', 'LimitAngularVelocityModifier3D', 'joint_count', '3', '"three"'],
    ['FLOAT', 'EditorProperty', 'name_split_ratio', '0.5', '"half"'],
    ['STRING', 'EditorDock', 'layout_key', '"key"', 'key'],
    ['STRING_NAME', 'EditorDock', 'icon_name', '&"Node"', 'Node'],
    ['NODE_PATH', 'ViewportTexture', 'viewport_path', 'NodePath("SubViewport")', '5'],
    ['OBJECT', 'EditorDock', 'dock_icon', 'ExtResource("1")', '"res://icon.png"'],
    ['VECTOR2', 'AnimationNodeBlendSpace2D', 'blend_point_0/pos', 'Vector2(1, 2)', 'Vector3(1, 2, 3)'],
    ['VECTOR2I', 'PlaceholderTextureLayered', 'size', 'Vector2i(1, 2)', '5'],
    ['RECT2', 'AtlasTexture', 'margin', 'Rect2(0, 0, 1, 1)', 'Vector2(1, 2)'],
    ['VECTOR3', 'BoxMesh', 'size', 'Vector3(1, 2, 3)', '"abc"'],
    ['TRANSFORM2D', 'FontVariation', 'variation_transform', 'Transform2D(1, 0, 0, 1, 0, 0)', '1'],
    ['QUATERNION', 'GLTFNode', 'rotation', 'Quaternion(0, 0, 0, 1)', 'Vector3(1, 2, 3)'],
    ['AABB', 'NavigationMesh', 'filter_baking_aabb', 'AABB(0, 0, 0, 1, 1, 1)', '1'],
    ['BASIS', 'GLTFPhysicsBody', 'inertia_tensor', 'Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)', '1'],
    ['TRANSFORM3D', 'GLTFNode', 'xform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)', '1'],
    ['COLOR', 'EditorDock', 'title_color', 'Color(1, 0, 0, 1)', '"red-ish"'],
    ['ARRAY', 'ShapeCast2D', 'collision_result', '[]', '5'],
    ['PACKED_FLOAT32_ARRAY', 'GLTFMesh', 'blend_weights', 'PackedFloat32Array(0, 1)', '"x"'],
    ['PACKED_STRING_ARRAY', 'OpenXRAction', 'toplevel_paths', 'PackedStringArray("a")', '5'],
    ['PACKED_VECTOR2_ARRAY', 'ConcavePolygonShape2D', 'segments', 'PackedVector2Array(0, 0, 1, 1)', '5'],
    ['PACKED_VECTOR3_ARRAY', 'ArrayOccluder3D', 'vertices', 'PackedVector3Array(0, 0, 0)', '5'],
    ['PACKED_COLOR_ARRAY', 'ColorPalette', 'colors', 'PackedColorArray(1, 0, 0, 1)', '5'],
  ])('%s: %s.%s accepts %s and refuses %s', (_type, className, key, good, bad) => {
    expectAccepted(check(className, key, good));
    expect(check(className, key, bad)).toBeAtTier('error');
  });

  it('accepts any value in a NIL slot, which holds any Variant', () => {
    expectAccepted(check('Curve', '_limits', '[0, 1]'));
    expectAccepted(check('Curve', '_limits', '5'));
  });

  it('gives a RID slot no check, since a .tscn holds only the default RID()', () => {
    expect(descriptorValidator(descriptorOf('OpenXRRenderModel', 'render_model'))).toBeNull();
  });

  it('reads an INT slot with no stated width at int64, the width of the Variant', () => {
    // `variant.h:248` stores an INT as int64_t. A setter that takes `int` is a hand row's `width`.
    expectAccepted(check('LimitAngularVelocityModifier3D', 'joint_count', '4294967296'));
  });

  it('marks the format check as format-only, citing nothing', () => {
    expect(validatorOf('BoxMesh', 'size').formatOnly).toBe(true);
    expect(validatorOf('BoxMesh', 'size').grounding).toBeUndefined();
  });
});

describe('PROPERTY_HINT_RANGE', () => {
  it('warns outside a closed float range, and accepts both ends', () => {
    // AnimatedTexture.frames: "1,256".
    expectAccepted(check('AnimatedTexture', 'frames', '1'));
    expectAccepted(check('AnimatedTexture', 'frames', '256'));
    expectWarning(check('AnimatedTexture', 'frames', '0'), '1');
    expectWarning(check('AnimatedTexture', 'frames', '257'), '256');
  });

  it('reports nothing past an end that or_greater opens', () => {
    // AnimatedTexture.frame_0/duration: "0.0,16.0,0.01,or_greater,suffix:s".
    expectAccepted(check('AnimatedTexture', 'frame_0/duration', '1000'));
    expectWarning(check('AnimatedTexture', 'frame_0/duration', '-1'), '0');
  });

  it('cites the capture for a hint bound', () => {
    expect(validatorOf('AnimatedTexture', 'frames').grounding).toEqual({
      kind: 'hinted',
      cite: 'ClassDB 4.6.3: AnimatedTexture.frames',
    });
  });

  it('bounds each component of a VECTOR3 range', () => {
    // GPUParticlesCollisionHeightField3D.size: "0.01,1024,0.01,or_greater,suffix:m".
    expectAccepted(check('GPUParticlesCollisionHeightField3D', 'size', 'Vector3(1, 1, 1)'));
    expectWarning(check('GPUParticlesCollisionHeightField3D', 'size', 'Vector3(0, 1, 1)'), '0.01');
  });

  it('converts a radians_as_degrees range to the radians the file stores', () => {
    // IterateIK3D.angular_delta_limit: "0,180,0.001,radians_as_degrees".
    expectAccepted(check('IterateIK3D', 'angular_delta_limit', '3.1415927'));
    expectWarning(check('IterateIK3D', 'angular_delta_limit', '3.2'), '180 degrees');
  });

  it('converts a radians_as_degrees range with an open end', () => {
    // LimitAngularVelocityModifier3D.max_angular_velocity: "0,720,or_greater,radians_as_degrees".
    expectAccepted(check('LimitAngularVelocityModifier3D', 'max_angular_velocity', '100'));
    expectWarning(check('LimitAngularVelocityModifier3D', 'max_angular_velocity', '-0.1'), '0');
  });
});

describe('PROPERTY_HINT_ENUM', () => {
  it('warns on a value the hint does not offer, with the hint labels', () => {
    // EditorDock.default_slot: "None:-1,Left Side Upper-Left,…,Bottom", values -1 to 8.
    expectAccepted(check('EditorDock', 'default_slot', '-1'));
    expectAccepted(check('EditorDock', 'default_slot', '8'));
    expectWarning(check('EditorDock', 'default_slot', '9'), '-1=None');
  });

  it('gives a STRING enum hint no bound: the file may hold any text', () => {
    expectAccepted(check('AudioEffectCompressor', 'sidechain', '&"Any Bus"'));
  });
});

describe('PROPERTY_HINT_FLAGS and PROPERTY_HINT_LAYERS_*', () => {
  it('warns on a bit the flag list does not offer', () => {
    // EditorDock.available_layouts: "Vertical:1,Horizontal:2,Floating:4".
    expectAccepted(check('EditorDock', 'available_layouts', '7'));
    expectWarning(check('EditorDock', 'available_layouts', '8'), 'Vertical');
  });

  it('accepts every 32-bit pattern of a layer mask', () => {
    expectAccepted(check('NavigationMesh', 'geometry_collision_mask', '4294967295'));
    expectAccepted(check('NavigationMesh', 'geometry_collision_mask', '-1'));
    expect(check('NavigationMesh', 'geometry_collision_mask', '"all"')).toBeAtTier('error');
  });
});

describe('a typed ARRAY and a node slot', () => {
  it('warns on an Array of another element type than PROPERTY_HINT_ARRAY_TYPE names', () => {
    expectAccepted(check('Compositor', 'compositor_effects', 'Array[CompositorEffect]([])'));
    expectWarning(check('Compositor', 'compositor_effects', 'Array[Font]([])'), 'CompositorEffect');
  });
});

describe('the hand row folds into the same check', () => {
  const base = descriptorOf('AnimatedTexture', 'frames');

  it('raises the hint ends to the error tier when the setter refuses outside them', () => {
    const validator = descriptorValidator({
      ...base,
      facts: { setter: { cite: 'animated_texture.cpp:1' } },
    })!;
    expectError(validator('frames', '0', 1), '1');
    expect(validator.grounding).toEqual({ kind: 'enforced', cite: 'animated_texture.cpp:1' });
  });

  it('keeps the hint end warning beside a setter end further out', () => {
    // frame_0/duration hints "0.0,16.0,0.01,or_greater", and this setter refuses -1 and below.
    const duration = descriptorOf('AnimatedTexture', 'frame_0/duration');
    const validator = descriptorValidator({
      ...duration,
      facts: { setter: { cite: 'animated_texture.cpp:1', min: { at: -1 } } },
    })!;
    expectWarning(validator('frame_0/duration', '-0.5', 1), '0');
    expectError(validator('frame_0/duration', '-2', 1), '-1');
  });

  it('prints the message the hand row states', () => {
    const validator = descriptorValidator({ ...base, facts: { message: "'frames' is 1 to 256" } })!;
    expectWarning(validator('frames', '300', 1), "'frames' is 1 to 256");
  });

  it('prints the constant names the hand row states in place of the hint labels', () => {
    const slot = descriptorOf('EditorDock', 'default_slot');
    const validator = descriptorValidator({
      ...slot,
      facts: { labels: { [-1]: 'DOCK_SLOT_NONE', 0: 'A' } },
    })!;
    expectWarning(validator('default_slot', '9', 1), '-1=DOCK_SLOT_NONE');
  });

  it('reads the slot at the width the hand row states', () => {
    const joints = descriptorOf('LimitAngularVelocityModifier3D', 'joint_count');
    const validator = descriptorValidator({ ...joints, facts: { width: 'int32' } })!;
    expectError(validator('joint_count', '4294967296', 1), 'cannot be stored');
  });

  it('refuses a hand row on a type with no bound to carry it', () => {
    expect(() =>
      descriptorValidator({ ...descriptorOf('BoxMesh', 'size'), facts: { message: 'm' } })
    ).toThrow('BoxMesh.size');
  });
});
