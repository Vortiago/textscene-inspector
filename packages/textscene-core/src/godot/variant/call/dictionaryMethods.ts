import { replaceAll } from '../../templates/arrayWrite.js';
import { sortList } from '../../templates/sortList.js';
import { dictionariesEqual, findEntry, hashCompare, isSameKey, setEntry } from '../compare.js';
import {
  assignedEntries,
  isSameContainerType,
  NULL_SCRIPT,
  typedArray,
  validatedElement,
} from '../construct/typedContainer.js';
import { duplicateVariant } from '../duplicate.js';
import { isOperatorLess } from '../operators/evaluate.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import {
  NIL,
  bool,
  int,
  variant,
  type ContainerType,
  type DictionaryEntry,
  type Variant,
  type VariantOf,
} from '../value/variant.js';
import { variantHash } from '../variantHash.js';
import { type MethodParameter, type MethodPort, portOn } from './methodPort.js';
import { isReadOnly, makeReadOnly, unlessReadOnly } from './readOnlyContainers.js';

type DictionaryVariant = VariantOf<'DICTIONARY'>;

const entriesOf = (dictionary: DictionaryVariant) => dictionary.value as DictionaryEntry[];

const port = portOn((base) => base as DictionaryVariant);

const validKey = (dictionary: DictionaryVariant, key: CastArgument) =>
  validatedElement(key as Variant, dictionary.keyType);
const validValue = (dictionary: DictionaryVariant, value: CastArgument) =>
  validatedElement(value as Variant, dictionary.valueType);

const otherOf = (argument: CastArgument) => argument as DictionaryVariant;

/** `Dictionary::has` (dictionary.cpp:188). */
function has(dictionary: DictionaryVariant, key: CastArgument): boolean {
  const valid = validKey(dictionary, key);
  return valid !== undefined && findEntry(dictionary.value, valid) !== undefined;
}

/** `Dictionary::get` (dictionary.cpp:150): the default for a refused or missing key. */
function get(dictionary: DictionaryVariant, key: CastArgument, fallback: Variant): Variant {
  const valid = validKey(dictionary, key);
  return (valid && findEntry(dictionary.value, valid)?.value) ?? fallback;
}

/** `Dictionary::get_or_add` (dictionary.cpp:159): a read-only dictionary keeps its entries. */
function getOrAdd(dictionary: DictionaryVariant, key: CastArgument, fallback: Variant): Variant {
  const valid = validKey(dictionary, key);
  if (!valid) return fallback;
  const entry = findEntry(dictionary.value, valid);
  if (entry) return entry.value;
  const value = validValue(dictionary, fallback);
  if (!value) return fallback;
  if (!isReadOnly(dictionary.value)) setEntry(entriesOf(dictionary), valid, value);
  return value;
}

/** `Dictionary::set` (dictionary.cpp:171). */
function set(dictionary: DictionaryVariant, key: CastArgument, value: CastArgument): Variant {
  if (isReadOnly(dictionary.value)) return bool(false);
  const [validatedKey, validatedValue] = [validKey(dictionary, key), validValue(dictionary, value)];
  if (!validatedKey || !validatedValue) return bool(false);
  setEntry(entriesOf(dictionary), validatedKey, validatedValue);
  return bool(true);
}

/** `Dictionary::has_all` (dictionary.cpp:194). */
const hasAll = (dictionary: DictionaryVariant, keys: CastArgument) =>
  bool((keys as VariantOf<'ARRAY'>).value.every((key) => has(dictionary, key)));

/** `Dictionary::find_key` (dictionary.cpp:206): the first key whose value is `hash_compare` equal. */
function findKey(dictionary: DictionaryVariant, what: CastArgument): Variant {
  const value = validValue(dictionary, what);
  if (!value) return NIL;
  return dictionary.value.find((entry) => hashCompare(entry.value, value))?.key ?? NIL;
}

/** `Dictionary::erase` (dictionary.cpp:217): the key check comes before the read-only one. */
function erase(dictionary: DictionaryVariant, key: CastArgument): Variant {
  const valid = validKey(dictionary, key);
  if (!valid || isReadOnly(dictionary.value)) return bool(false);
  const entries = entriesOf(dictionary);
  const index = entries.findIndex((entry) => isSameKey(entry.key, valid));
  if (index >= 0) entries.splice(index, 1);
  return bool(index >= 0);
}

/** `Dictionary::merge` (dictionary.cpp:282): a refused entry stops the merge, keeping those before it. */
function merge(dictionary: DictionaryVariant, other: DictionaryVariant, isOverwriting: boolean): void {
  if (isReadOnly(dictionary.value)) return;
  for (const entry of [...other.value]) {
    const [key, value] = [validKey(dictionary, entry.key), validValue(dictionary, entry.value)];
    if (!key || !value) return;
    if (isOverwriting || !has(dictionary, key)) setEntry(entriesOf(dictionary), key, value);
  }
}

/** `Dictionary::merged` (dictionary.cpp:296): a shallow copy, merged. */
function merged(dictionary: DictionaryVariant, other: DictionaryVariant, isOverwriting: boolean): Variant {
  const copy = duplicateVariant(dictionary, false) as DictionaryVariant;
  merge(copy, other, isOverwriting);
  return copy;
}

/** `Dictionary::assign` (dictionary.cpp:351): the entries stay where a key or value cannot convert. */
function assign(dictionary: DictionaryVariant, source: DictionaryVariant): Variant {
  const entries = assignedEntries(source, dictionary.keyType, dictionary.valueType);
  if (entries) replaceAll(entriesOf(dictionary), entries);
  return NIL;
}

/** `_DictionaryVariantSort` (dictionary.cpp:259): by key, an invalid `<` sorting as false. */
function sort(dictionary: DictionaryVariant): Variant {
  sortList(entriesOf(dictionary), (a, b) => isOperatorLess(a.key, b.key));
  return NIL;
}

const typedBuiltin = (type: ContainerType | undefined) => int(type?.type ?? 0);
const typedClassName = (type: ContainerType | undefined) => variant('STRING_NAME', type?.className ?? '');

const changing = (
  parameters: readonly MethodParameter[],
  body: (dictionary: DictionaryVariant, args: readonly CastArgument[]) => Variant
) => port(parameters, unlessReadOnly(body));

export const DICTIONARY_METHODS: Readonly<Record<string, MethodPort>> = {
  size: port([], (dictionary) => int(dictionary.value.length)),
  is_empty: port([], (dictionary) => bool(dictionary.value.length === 0)),
  clear: changing([], (dictionary) => {
    entriesOf(dictionary).length = 0;
    return NIL;
  }),
  assign: changing(['DICTIONARY'], (dictionary, args) => assign(dictionary, otherOf(args[0]!))),
  sort: changing([], sort),
  merge: port(['DICTIONARY', 'bool'], (dictionary, args) => {
    merge(dictionary, otherOf(args[0]!), args[1] as boolean);
    return NIL;
  }),
  merged: port(['DICTIONARY', 'bool'], (dictionary, args) =>
    merged(dictionary, otherOf(args[0]!), args[1] as boolean)
  ),
  has: port(['Variant'], (dictionary, args) => bool(has(dictionary, args[0]!))),
  has_all: port(['ARRAY'], (dictionary, args) => hasAll(dictionary, args[0]!)),
  find_key: port(['Variant'], (dictionary, args) => findKey(dictionary, args[0]!)),
  erase: port(['Variant'], (dictionary, args) => erase(dictionary, args[0]!)),
  hash: port([], (dictionary) => int(variantHash(dictionary))),
  keys: port([], (dictionary) =>
    typedArray(
      dictionary.value.map(({ key }) => key),
      dictionary.keyType
    )
  ),
  values: port([], (dictionary) =>
    typedArray(
      dictionary.value.map(({ value }) => value),
      dictionary.valueType
    )
  ),
  duplicate: port(['bool'], (dictionary, args) => duplicateVariant(dictionary, args[0] as boolean)),
  duplicate_deep: port(['int32_t'], (dictionary) => duplicateVariant(dictionary, true)),
  get: port(['Variant', 'Variant'], (dictionary, args) => get(dictionary, args[0]!, args[1] as Variant)),
  get_or_add: port(['Variant', 'Variant'], (dictionary, args) =>
    getOrAdd(dictionary, args[0]!, args[1] as Variant)
  ),
  set: port(['Variant', 'Variant'], (dictionary, args) => set(dictionary, args[0]!, args[1]!)),
  is_typed: port([], (dictionary) =>
    bool(dictionary.keyType !== undefined || dictionary.valueType !== undefined)
  ),
  is_typed_key: port([], (dictionary) => bool(dictionary.keyType !== undefined)),
  is_typed_value: port([], (dictionary) => bool(dictionary.valueType !== undefined)),
  is_same_typed: port(['DICTIONARY'], (dictionary, args) => {
    const other = otherOf(args[0]!);
    const isSameKey = isSameContainerType(dictionary.keyType, other.keyType);
    return bool(isSameKey && isSameContainerType(dictionary.valueType, other.valueType));
  }),
  is_same_typed_key: port(['DICTIONARY'], (dictionary, args) =>
    bool(isSameContainerType(dictionary.keyType, otherOf(args[0]!).keyType))
  ),
  is_same_typed_value: port(['DICTIONARY'], (dictionary, args) =>
    bool(isSameContainerType(dictionary.valueType, otherOf(args[0]!).valueType))
  ),
  get_typed_key_builtin: port([], (dictionary) => typedBuiltin(dictionary.keyType)),
  get_typed_value_builtin: port([], (dictionary) => typedBuiltin(dictionary.valueType)),
  get_typed_key_class_name: port([], (dictionary) => typedClassName(dictionary.keyType)),
  get_typed_value_class_name: port([], (dictionary) => typedClassName(dictionary.valueType)),
  get_typed_key_script: port([], () => NULL_SCRIPT),
  get_typed_value_script: port([], () => NULL_SCRIPT),
  make_read_only: port([], (dictionary) => {
    makeReadOnly(dictionary.value);
    return NIL;
  }),
  is_read_only: port([], (dictionary) => bool(isReadOnly(dictionary.value))),
  recursive_equal: port(['DICTIONARY', 'int32_t'], (dictionary, args) =>
    bool(dictionariesEqual(dictionary.value, otherOf(args[0]!).value, args[1] as number))
  ),
};
