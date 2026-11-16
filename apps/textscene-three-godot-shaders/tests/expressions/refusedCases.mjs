const OBJECTS = 'the case makes a Godot object, which waits on #1953';
const EDITOR_STATE = 'the answer is a counter or an object id of the running editor';
const MEMBERS = 'the methods and members slice ports the index';
const INTERNED_ADDRESS =
  'StringName::operator< compares the addresses of two interned texts (string_name.h:97), which differ by run';

/** Each refused case's id and the class of what it throws. */
export const REFUSED_CASES = {
  'parser 53 "[1][0]"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 55 "\\"a\\".b"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'parser 59 "(1).x"': { refusal: 'UnportedExpression', reason: MEMBERS },
  'object-edge 0 "weakref(null)"': { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 1 "weakref(Object())"': { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 4 "str_to_var(\\"Object(Node,)\\")"': { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 5 "str_to_var(\\"Object(Gradient,\\\\\\"offsets\\\\\\":PackedFloat32Array(0.5))\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 9 "str_to_var(\\"Resource(\\\\\\"res://nope.tres\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 10 "str_to_var(\\"SubResource(\\\\\\"1\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 11 "str_to_var(\\"ExtResource(\\\\\\"uid://abc\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 27 "bytes_to_var_with_objects(PackedByteArray([24, 0, 0, 0, 4, 0, 0, 0, 78, 111, 100, 101, 0, 0, 0, 0]))"':
    { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 20 "bytes_to_var(PackedByteArray([24, 0, 1, 0, 7, 0, 0, 0, 0, 0, 0, 0]))"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
};

/** The comparisons of two distinct non-empty StringNames, which the port refuses wherever the set has one. */
export const INTERNED_COMPARISON = { refusal: 'UnportableComparison', reason: INTERNED_ADDRESS };

/** The utility functions the port refuses wherever the set calls them, with the reason. */
export const REFUSED_UTILITIES = {
  weakref: { refusal: 'UnsupportedObject', reason: OBJECTS },
  rid_allocate_id: { refusal: 'UnportableUtility', reason: EDITOR_STATE },
};
