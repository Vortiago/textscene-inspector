const OBJECTS = 'the case makes a Godot object, which waits on #1953';
const UID = "the project's uid cache decides a uid, and the transpiler cannot read that cache (#1815)";
const EDITOR_STATE = 'the answer is a counter or an object id of the running editor';
const MACHINE_ICONV = 'the answer converts with the iconv and locale of the machine Godot runs on';
const PAST_UNICODE =
  'the String holds a code past U+10FFFF, which a JavaScript string cannot hold, so the port refuses it';
const INTERNED_ADDRESS =
  'StringName::operator< compares the addresses of two interned texts (string_name.h:97), which differ by run';

/** Each refused case's id and the class of what it throws. */
export const REFUSED_CASES = {
  'object-edge 0 "weakref(null)"': { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 1 "weakref(Object())"': { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 4 "str_to_var(\\"Object(Node,)\\")"': { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 5 "str_to_var(\\"Object(Gradient,\\\\\\"offsets\\\\\\":PackedFloat32Array(0.5))\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 27 "bytes_to_var_with_objects(PackedByteArray([24, 0, 0, 0, 4, 0, 0, 0, 78, 111, 100, 101, 0, 0, 0, 0]))"':
    { refusal: 'UnsupportedObject', reason: OBJECTS },
  'object-edge 30 "str_to_var(\\"Resource(\\\\\\"res://main.tscn\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 31 "str_to_var(\\"Resource(\\\\\\"main.tscn\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 32 "str_to_var(\\"Resource(\\\\\\"res://./main.gd\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'object-edge 34 "str_to_var(\\"ExtResource(\\\\\\"res://nope.tres\\\\\\", \\\\\\"uid://abc\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: UID,
  },
  'object-edge 11 "str_to_var(\\"ExtResource(\\\\\\"uid://abc\\\\\\")\\")"': {
    refusal: 'UnsupportedObject',
    reason: UID,
  },
  'object-edge 20 "bytes_to_var(PackedByteArray([24, 0, 1, 0, 7, 0, 0, 0, 0, 0, 0, 0]))"': {
    refusal: 'UnsupportedObject',
    reason: OBJECTS,
  },
  'method String.replace_chars 31 "\\"a_red.b/#F80 a 😀İ\\".replace_chars(\\"#ff8000\\", -1)"': {
    refusal: 'UnrepresentableText',
    reason: PAST_UNICODE,
  },
  'method String.replace_chars 32 "\\"a_red.b/#F80 a 😀İ\\".replace_chars(\\"#ff8000\\", -7)"': {
    refusal: 'UnrepresentableText',
    reason: PAST_UNICODE,
  },
  'method String.replace_chars 33 "\\"a_red.b/#F80 a 😀İ\\".replace_chars(\\"#ff8000\\", 2147483647)"': {
    refusal: 'UnrepresentableText',
    reason: PAST_UNICODE,
  },
  'method String.replace_chars 34 "\\"a_red.b/#F80 a 😀İ\\".replace_chars(\\"#ff8000\\", -2147483648)"': {
    refusal: 'UnrepresentableText',
    reason: PAST_UNICODE,
  },
  'method StringName.replace_chars 31 "StringName(\\"a_red.b/#F80 a 😀İ\\").replace_chars(\\"#ff8000\\", -1)"':
    { refusal: 'UnrepresentableText', reason: PAST_UNICODE },
  'method StringName.replace_chars 32 "StringName(\\"a_red.b/#F80 a 😀İ\\").replace_chars(\\"#ff8000\\", -7)"':
    { refusal: 'UnrepresentableText', reason: PAST_UNICODE },
  'method StringName.replace_chars 33 "StringName(\\"a_red.b/#F80 a 😀İ\\").replace_chars(\\"#ff8000\\", 2147483647)"':
    { refusal: 'UnrepresentableText', reason: PAST_UNICODE },
  'method StringName.replace_chars 34 "StringName(\\"a_red.b/#F80 a 😀İ\\").replace_chars(\\"#ff8000\\", -2147483648)"':
    { refusal: 'UnrepresentableText', reason: PAST_UNICODE },
};

/** The methods the port refuses wherever the set calls them, with the reason. */
export const REFUSED_METHODS = {
  to_multibyte_char_buffer: { refusal: 'UnportableUtility', reason: MACHINE_ICONV },
};

/** The comparisons of two distinct non-empty StringNames, which the port refuses wherever the set has one. */
export const INTERNED_COMPARISON = { refusal: 'UnportableComparison', reason: INTERNED_ADDRESS };

/** The utility functions the port refuses wherever the set calls them, with the reason. */
export const REFUSED_UTILITIES = {
  weakref: { refusal: 'UnsupportedObject', reason: OBJECTS },
  rid_allocate_id: { refusal: 'UnportableUtility', reason: EDITOR_STATE },
};
