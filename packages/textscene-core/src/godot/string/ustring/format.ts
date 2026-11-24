import { stringify } from '../../variant/stringify.js';
import type { Variant } from '../../variant/value/variant.js';
import { codesOf, textOf } from './codes.js';
import { replace, replaceFirst } from './edit.js';
import { unfolded } from './search.js';

const replaced = (self: string, key: string, value: string) =>
  textOf(replace(codesOf(self), codesOf(key), codesOf(value), unfolded));

/** A key in the placeholder: each `_` in it becomes the key's text. */
const keyed = (placeholder: string, key: Variant) => replaced(placeholder, '_', stringify(key));

/** A two-element Array is a key and its value, and any other Array is skipped. */
function withElement(self: string, element: Variant, index: number, placeholder: string): string {
  if (element.type === 'ARRAY') {
    const pair = element.value;
    return pair.length === 2 ? replaced(self, keyed(placeholder, pair[0]!), stringify(pair[1]!)) : self;
  }
  if (placeholder.includes('_'))
    return replaced(self, replaced(placeholder, '_', String(index)), stringify(element));
  return textOf(replaceFirst(codesOf(self), codesOf(placeholder), codesOf(stringify(element))));
}

/** `String::format` (ustring.cpp:3553): every OBJECT the port holds is null, which leaves the text. */
export function formatted(self: string, values: Variant, placeholder: string): string {
  if (values.type === 'ARRAY')
    return values.value.reduce(
      (text, element, index) => withElement(text, element, index, placeholder),
      self
    );
  if (values.type === 'DICTIONARY')
    return values.value.reduce(
      (text, { key, value }) => replaced(text, keyed(placeholder, key), stringify(value)),
      self
    );
  return self;
}
