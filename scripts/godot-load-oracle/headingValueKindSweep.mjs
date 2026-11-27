import { fileWithField, HEADING_KINDS, writeCases } from './headingSweepScene.mjs';

/** Each value kind a heading field can hold. */
const VALUES = {
  string: '"v"',
  number: '7',
  identifier: 'abc',
  bool: 'true',
  ext_resource: 'ExtResource("1")',
  sub_resource: 'SubResource("s")',
  // The id of the sweep's own `[sub_resource]` heading: a later one, or the heading itself.
  sub_resource_own_id: 'SubResource("t")',
  resource_absolute: 'Resource("res://gone_abs.tres")',
  resource_relative: 'Resource("sub/gone_rel.tres")',
  array: '[1, "a"]',
  dictionary: '{"k": 2}',
  nested: '{"k": [ExtResource("1"), {"j": Resource("res://gone_nest.tres")}]}',
  unknown_constructor: 'Foo(1)',
};

const cases = HEADING_KINDS.flatMap((kind) =>
  Object.entries(VALUES).map(([value, text]) => ({
    name: `${kind}__${value}`,
    ...fileWithField(kind, `x=${text}`),
  }))
);
console.log(writeCases(process.argv[2], cases));
