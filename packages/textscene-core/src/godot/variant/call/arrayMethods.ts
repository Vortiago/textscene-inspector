import { appendAll, replaceAll } from '../../templates/arrayWrite.js';
import { bisect } from '../../templates/bisect.js';
import { sortArray } from '../../templates/sortArray.js';
import { booleanize, hashCompare, isSameKey } from '../compare.js';
import {
  assignedElements,
  canReference,
  isSameContainerType,
  NULL_SCRIPT,
  typedArray,
  validatedElement,
} from '../construct/typedContainer.js';
import { duplicateVariant } from '../duplicate.js';
import { evaluateOperator, isOperatorLess } from '../operators/evaluate.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { defaultValue } from '../value/defaultValue.js';
import {
  NIL,
  bool,
  int,
  variant,
  type CallableValue,
  type Variant,
  type VariantOf,
} from '../value/variant.js';
import { variantHash } from '../variantHash.js';
import { VARIANT_TYPE, variantTypeOf } from '../variantType.js';
import { representableLength } from './arrayLength.js';
import { ERROR_CODE } from './errorCode.js';
import { type MethodContext, type MethodParameter, type MethodPort, portOn } from './methodPort.js';
import { isReadOnly, makeReadOnly, unlessReadOnly } from './readOnlyContainers.js';

type ArrayVariant = VariantOf<'ARRAY'>;

const elementsOf = (array: ArrayVariant) => array.value as Variant[];

const port = portOn((base) => base as ArrayVariant);

const changing = (
  parameters: readonly MethodParameter[],
  body: (array: ArrayVariant, args: readonly CastArgument[], context: MethodContext) => Variant,
  failed?: Variant
) => port(parameters, unlessReadOnly(body, failed));

/** `ContainerTypeValidate::validate`: the element as the array stores it, or nothing where it refuses. */
const validated = (array: ArrayVariant, value: CastArgument) =>
  validatedElement(value as Variant, array.elementType);

const fromEnd = (index: number, length: number) => (index < 0 ? index + length : index);

/** The value a call returns, or nothing on a call error. */
function called(
  context: MethodContext,
  callable: CallableValue,
  args: readonly Variant[]
): Variant | undefined {
  const result = context.callp(callable, args);
  return result.isValid ? result.value : undefined;
}

/** `CallableComparator` (callable.cpp:597): a call error sorts as false. */
const callableLess = (callable: CallableValue, context: MethodContext) => (a: Variant, b: Variant) => {
  const result = called(context, callable, [a, b]);
  return result !== undefined && booleanize(result);
};

/** `Array::find` (array.cpp:378). */
function find(array: ArrayVariant, what: CastArgument, from: number): Variant {
  const elements = array.value;
  if (elements.length === 0) return int(-1);
  const value = validated(array, what);
  if (!value || from < 0) return int(-1);
  for (let index = from; index < elements.length; index++)
    if (isSameKey(elements[index]!, value)) return int(index);
  return int(-1);
}

/** `Array::rfind` (array.cpp:423): a start past either end starts at the last element. */
function rfind(array: ArrayVariant, what: CastArgument, from: number): Variant {
  const elements = array.value;
  if (elements.length === 0) return int(-1);
  const value = validated(array, what);
  if (!value) return int(-1);
  for (let index = startFromEnd(from, elements.length); index >= 0; index--)
    if (isSameKey(elements[index]!, value)) return int(index);
  return int(-1);
}

function startFromEnd(from: number, length: number): number {
  const start = fromEnd(from, length);
  return start < 0 || start >= length ? length - 1 : start;
}

/** The index of the first element `callable` answers true for, from `indexes`; -1 on a call error. */
function findCustom(
  array: ArrayVariant,
  callable: CallableValue,
  indexes: Iterable<number>,
  context: MethodContext
) {
  for (const index of indexes) {
    const result = called(context, callable, [array.value[index]!]);
    if (result === undefined || result.type !== 'BOOL') return int(-1);
    if (result.value) return int(index);
  }
  return int(-1);
}

function* upFrom(from: number, length: number) {
  for (let index = from; index < length; index++) yield index;
}

function* downFrom(from: number) {
  for (let index = from; index >= 0; index--) yield index;
}

/** `Array::count` (array.cpp:464). */
function count(array: ArrayVariant, what: CastArgument): Variant {
  const value = validated(array, what);
  if (!value) return int(0);
  return int(array.value.filter((element) => isSameKey(element, value)).length);
}

/** `Array::assign` (array.cpp:217): the elements stay as they are where the source cannot convert. */
function assign(array: ArrayVariant, source: ArrayVariant): Variant {
  const elements = assignedElements(source.value, source.elementType, array.elementType);
  if (elements) replaceAll(elementsOf(array), elements);
  return NIL;
}

/** `Array::append_array` (array.cpp:291): nothing is added when one element is refused. */
function appendArray(array: ArrayVariant, other: ArrayVariant): Variant {
  const isReferenced = !array.elementType || canReference(array.elementType, other.elementType);
  const elements = isReferenced ? other.value : other.value.map((element) => validated(array, element));
  if (elements.every((element) => element !== undefined)) appendAll(elementsOf(array), elements as Variant[]);
  return NIL;
}

/** `Array::resize` (array.cpp:307): a typed array fills with its type's default, an untyped one with null. */
function resize(array: ArrayVariant, size: number): Variant {
  if (size < 0) return int(ERROR_CODE.ERR_INVALID_PARAMETER);
  const elements = elementsOf(array);
  const oldLength = elements.length;
  elements.length = representableLength(size);
  const type = variantTypeOf(array.elementType?.type ?? VARIANT_TYPE.NIL);
  const fill = () => (type === undefined || type === 'OBJECT' ? NIL : defaultValue(type));
  for (let index = oldLength; index < size; index++) elements[index] = fill();
  return int(ERROR_CODE.OK);
}

/** `Array::insert` (array.cpp:325): a position from the end when negative, up to the size. */
function insert(array: ArrayVariant, position: number, what: CastArgument): Variant {
  const value = validated(array, what);
  if (!value) return int(ERROR_CODE.ERR_INVALID_PARAMETER);
  const at = fromEnd(position, array.value.length);
  if (at < 0 || at > array.value.length) return int(ERROR_CODE.ERR_INVALID_PARAMETER);
  elementsOf(array).splice(at, 0, value);
  return int(ERROR_CODE.OK);
}

/** `Vector::erase` (vector.h:93): the first element `==` the value, which is `hash_compare`. */
function erase(array: ArrayVariant, what: CastArgument): Variant {
  const value = validated(array, what);
  if (!value) return NIL;
  const index = array.value.findIndex((element) => hashCompare(element, value));
  if (index >= 0) elementsOf(array).splice(index, 1);
  return NIL;
}

/** `Array::remove_at` and `pop_at` (array.cpp:487, 798): a position from the end when negative. */
function removeAt(array: ArrayVariant, position: number): Variant {
  const at = fromEnd(position, array.value.length);
  if (at < 0 || at >= array.value.length) return NIL;
  return elementsOf(array).splice(at, 1)[0]!;
}

/** `Array::slice` (array.cpp:566). */
function slice(array: ArrayVariant, [begin, end, step, isDeep]: readonly CastArgument[]): Variant {
  const result = typedArray([], array.elementType);
  const length = array.value.length;
  const [from, to, by] = [begin as number, end as number, step as number];
  if (by === 0 || length === 0 || (from < -length && by < 0) || (from >= length && by > 0)) return result;
  const first = fromEnd(Math.min(Math.max(from, -length), length - 1), length);
  const last = fromEnd(Math.min(Math.max(to, -length - 1), length), length);
  if ((by > 0 && first > last) || (by < 0 && first < last)) return result;
  const span = last - first;
  const size = Math.trunc(span / by) + (span % by !== 0 ? 1 : 0);
  for (let index = 0, source = first; index < size; index++, source += by) {
    const element = array.value[source]!;
    elementsOf(result).push(isDeep ? duplicateVariant(element, true) : element);
  }
  return result;
}

/** `Array::filter` (array.cpp:597): an untyped empty array on a call error. */
function filter(array: ArrayVariant, callable: CallableValue, context: MethodContext): Variant {
  const accepted: Variant[] = [];
  for (let index = 0; index < array.value.length; index++) {
    const element = array.value[index]!;
    const result = called(context, callable, [element]);
    if (result === undefined) return variant('ARRAY', []);
    if (booleanize(result)) accepted.push(element);
  }
  return typedArray(accepted, array.elementType);
}

/** `Array::map` (array.cpp:621): an empty array on a call error. */
function map(array: ArrayVariant, callable: CallableValue, context: MethodContext): Variant {
  const mapped: Variant[] = [];
  for (let index = 0; index < array.value.length; index++) {
    const result = called(context, callable, [array.value[index]!]);
    if (result === undefined) return variant('ARRAY', []);
    mapped.push(result);
  }
  return variant('ARRAY', mapped);
}

/** `Array::reduce` (array.cpp:639): a null start takes the first element; null on a call error. */
function reduce(
  array: ArrayVariant,
  callable: CallableValue,
  start: Variant,
  context: MethodContext
): Variant {
  const isFromFirst = start.type === 'NIL' && array.value.length > 0;
  let accumulated = isFromFirst ? array.value[0]! : start;
  for (let index = isFromFirst ? 1 : 0; index < array.value.length; index++) {
    const result = called(context, callable, [accumulated, array.value[index]!]);
    if (result === undefined) return NIL;
    accumulated = result;
  }
  return accumulated;
}

/** `Array::any` and `Array::all` (array.cpp:662, 680): false on a call error. */
function isAnswered(
  array: ArrayVariant,
  callable: CallableValue,
  wanted: boolean,
  context: MethodContext
): Variant {
  for (let index = 0; index < array.value.length; index++) {
    const result = called(context, callable, [array.value[index]!]);
    if (result === undefined) return bool(false);
    if (booleanize(result) === wanted) return bool(wanted);
  }
  return bool(!wanted);
}

/** `Array::min` and `Array::max` (array.cpp:820, 840): null on an invalid comparison. */
function extreme(array: ArrayVariant, operator: 'OP_LESS' | 'OP_GREATER'): Variant {
  const elements = array.value;
  if (elements.length === 0) return NIL;
  let best = 0;
  for (let index = 1; index < elements.length; index++) {
    const { value, isValid } = evaluateOperator(operator, elements[index]!, elements[best]!);
    if (!isValid) return NIL;
    if (booleanize(value)) best = index;
  }
  return elements[best]!;
}

/** `Array::pick_random` (array.cpp:370): `Math::rand() % size`. */
function pickRandom(array: ArrayVariant, context: MethodContext): Variant {
  if (array.value.length === 0) return NIL;
  return array.value[context.random.draw().rand() % array.value.length]!;
}

/** `Array::shuffle` (array.cpp:739): Fisher-Yates from the back, each swap index `Math::rand() % (i + 1)`. */
function shuffle(array: ArrayVariant, context: MethodContext): Variant {
  const elements = elementsOf(array);
  for (let index = elements.length - 1; index >= 1; index--) {
    const other = context.random.draw().rand() % (index + 1);
    [elements[index], elements[other]] = [elements[other]!, elements[index]!];
  }
  return NIL;
}

/** `func_Array_get` and `func_Array_set` (variant_call.cpp:671): no index from the end. */
const isIndexIn = (array: ArrayVariant, index: bigint) => index >= 0n && index < BigInt(array.value.length);

function set(array: ArrayVariant, index: bigint, what: CastArgument): Variant {
  if (!isIndexIn(array, index) || isReadOnly(array.value)) return NIL;
  const value = validated(array, what);
  if (value) elementsOf(array)[Number(index)] = value;
  return NIL;
}

export const ARRAY_METHODS: Readonly<Record<string, MethodPort>> = {
  size: port([], (array) => int(array.value.length)),
  is_empty: port([], (array) => bool(array.value.length === 0)),
  clear: changing([], (array) => {
    elementsOf(array).length = 0;
    return NIL;
  }),
  hash: port([], (array) => int(variantHash(array))),
  assign: changing(['ARRAY'], (array, args) => assign(array, args[0] as ArrayVariant)),
  get: port(['int64_t'], (array, args) =>
    isIndexIn(array, args[0] as bigint) ? array.value[Number(args[0])]! : NIL
  ),
  set: port(['int64_t', 'Variant'], (array, args) => set(array, args[0] as bigint, args[1]!)),
  push_back: changing(['Variant'], (array, args) => pushed(array, args[0]!)),
  push_front: changing(['Variant'], (array, args) => pushedFront(array, args[0]!)),
  append: changing(['Variant'], (array, args) => pushed(array, args[0]!)),
  append_array: changing(['ARRAY'], (array, args) => appendArray(array, args[0] as ArrayVariant)),
  resize: changing(
    ['int32_t'],
    (array, args) => resize(array, args[0] as number),
    int(ERROR_CODE.ERR_LOCKED)
  ),
  insert: changing(
    ['int32_t', 'Variant'],
    (array, args) => insert(array, args[0] as number, args[1]!),
    int(ERROR_CODE.ERR_LOCKED)
  ),
  remove_at: changing(['int32_t'], (array, args) => (removeAt(array, args[0] as number), NIL)),
  fill: changing(['Variant'], (array, args) => filled(array, args[0]!)),
  erase: changing(['Variant'], (array, args) => erase(array, args[0]!)),
  front: port([], (array) => array.value[0] ?? NIL),
  back: port([], (array) => array.value.at(-1) ?? NIL),
  pick_random: port([], (array, _, context) => pickRandom(array, context)),
  find: port(['Variant', 'int32_t'], (array, args) => find(array, args[0]!, args[1] as number)),
  find_custom: port(['CALLABLE', 'int32_t'], (array, args, context) => {
    const from = args[1] as number;
    if (from < 0) return int(-1);
    return findCustom(array, callableOf(args[0]!), upFrom(from, array.value.length), context);
  }),
  rfind: port(['Variant', 'int32_t'], (array, args) => rfind(array, args[0]!, args[1] as number)),
  rfind_custom: port(['CALLABLE', 'int32_t'], (array, args, context) => {
    if (array.value.length === 0) return int(-1);
    const from = startFromEnd(args[1] as number, array.value.length);
    return findCustom(array, callableOf(args[0]!), downFrom(from), context);
  }),
  count: port(['Variant'], (array, args) => count(array, args[0]!)),
  has: port(['Variant'], (array, args) => bool((find(array, args[0]!, 0).value as bigint) !== -1n)),
  pop_back: changing([], (array) => elementsOf(array).pop() ?? NIL),
  pop_front: changing([], (array) => elementsOf(array).shift() ?? NIL),
  pop_at: changing(['int32_t'], (array, args) => removeAt(array, args[0] as number)),
  sort: changing([], (array) => (sortArray(elementsOf(array), isOperatorLess), NIL)),
  sort_custom: changing(['CALLABLE'], (array, args, context) => {
    sortArray(elementsOf(array), callableLess(callableOf(args[0]!), context));
    return NIL;
  }),
  shuffle: changing([], (array, _, context) => shuffle(array, context)),
  bsearch: port(['Variant', 'bool'], (array, args) => {
    const value = validated(array, args[0]!);
    return value ? int(bisect(array.value, value, args[1] as boolean, isOperatorLess)) : int(-1);
  }),
  bsearch_custom: port(['Variant', 'CALLABLE', 'bool'], (array, args, context) => {
    const value = validated(array, args[0]!);
    if (!value) return int(-1);
    return int(bisect(array.value, value, args[2] as boolean, callableLess(callableOf(args[1]!), context)));
  }),
  reverse: changing([], (array) => (elementsOf(array).reverse(), NIL)),
  duplicate: port(['bool'], (array, args) => duplicateVariant(array, args[0] as boolean)),
  duplicate_deep: port(['int32_t'], (array) => duplicateVariant(array, true)),
  slice: port(['int32_t', 'int32_t', 'int32_t', 'bool'], slice),
  filter: port(['CALLABLE'], (array, args, context) => filter(array, callableOf(args[0]!), context)),
  map: port(['CALLABLE'], (array, args, context) => map(array, callableOf(args[0]!), context)),
  reduce: port(['CALLABLE', 'Variant'], (array, args, context) =>
    reduce(array, callableOf(args[0]!), args[1] as Variant, context)
  ),
  any: port(['CALLABLE'], (array, args, context) => isAnswered(array, callableOf(args[0]!), true, context)),
  all: port(['CALLABLE'], (array, args, context) => isAnswered(array, callableOf(args[0]!), false, context)),
  max: port([], (array) => extreme(array, 'OP_GREATER')),
  min: port([], (array) => extreme(array, 'OP_LESS')),
  is_typed: port([], (array) => bool(array.elementType !== undefined)),
  is_same_typed: port(['ARRAY'], (array, args) =>
    bool(isSameContainerType(array.elementType, (args[0] as ArrayVariant).elementType))
  ),
  get_typed_builtin: port([], (array) => int(array.elementType?.type ?? 0)),
  get_typed_class_name: port([], (array) => variant('STRING_NAME', array.elementType?.className ?? '')),
  get_typed_script: port([], () => NULL_SCRIPT),
  make_read_only: port([], (array) => (makeReadOnly(array.value), NIL)),
  is_read_only: port([], (array) => bool(isReadOnly(array.value))),
};

const callableOf = (argument: CastArgument) => (argument as VariantOf<'CALLABLE'>).value;

function pushed(array: ArrayVariant, what: CastArgument): Variant {
  const value = validated(array, what);
  if (value) elementsOf(array).push(value);
  return NIL;
}

function pushedFront(array: ArrayVariant, what: CastArgument): Variant {
  const value = validated(array, what);
  if (value) elementsOf(array).unshift(value);
  return NIL;
}

function filled(array: ArrayVariant, what: CastArgument): Variant {
  const value = validated(array, what);
  if (value) elementsOf(array).fill(value);
  return NIL;
}
