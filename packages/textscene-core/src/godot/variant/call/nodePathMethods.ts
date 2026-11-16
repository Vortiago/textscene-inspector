import { hashOneUint64, stringHash } from '../../math/hashFuncs.js';
import type { NodePathParts } from '../../string/nodePathParts.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { variant, type Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

const int = (value: bigint | number): Variant => variant('INT', BigInt(value));
const name = (value: string): Variant => variant('STRING_NAME', value);
const nodePath = (absolute: boolean, names: readonly string[], subnames: readonly string[]): Variant =>
  variant('NODE_PATH', { absolute, names, subnames });

const port = (
  parameters: readonly MethodParameter[],
  body: (path: NodePathParts, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(base.value as NodePathParts, args));

/** A NodePath without `data`: both constructors leave a relative path with no names and no subnames empty. */
const isEmpty = ({ absolute, names, subnames }: NodePathParts) =>
  !absolute && names.length === 0 && subnames.length === 0;

const concatenatedNames = (path: NodePathParts) => path.names.join('/');
const concatenatedSubnames = (path: NodePathParts) => path.subnames.join(':');

/** `NodePath::hash` (node_path.cpp:34): the two concatenations hashed as a pair, inverted when relative. */
function hash(path: NodePathParts): number {
  if (isEmpty(path)) return 0;
  const pair =
    (BigInt(stringHash(concatenatedNames(path))) << 32n) | BigInt(stringHash(concatenatedSubnames(path)));
  const hashed = hashOneUint64(BigInt.asIntN(64, pair));
  return path.absolute ? hashed : ~hashed >>> 0;
}

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);
const fromEnd = (index: number, count: number) => (index < 0 ? index + count : index);

/** `Vector::slice` (vector.h:227): empty when the begin passes the end. */
function vectorSlice<T>(items: readonly T[], begin: number, end: number): T[] {
  const from = fromEnd(clamp(begin, items.length), items.length);
  const to = fromEnd(clamp(end, items.length), items.length);
  return from > to ? [] : items.slice(from, to);
}

/** `NodePath::slice` (node_path.cpp:240): the names and then the subnames, counted as one run. */
function sliced(path: NodePathParts, begin: number, end: number): Variant {
  const total = path.names.length + path.subnames.length;
  const from = fromEnd(clamp(begin, total), total);
  const to = fromEnd(clamp(end, total), total);
  const names = vectorSlice(path.names, from, to);
  const subnames = vectorSlice(
    path.subnames,
    Math.max(from - path.names.length, 0),
    Math.max(to - path.names.length, 0)
  );
  return nodePath(path.absolute && from === 0, names, subnames);
}

/** `NodePath::get_as_property_path` (node_path.cpp:310): the names joined into the first subname. */
function propertyPath(path: NodePathParts): Variant {
  if (path.names.length === 0) return variant('NODE_PATH', path);
  return nodePath(false, [], [concatenatedNames(path), ...path.subnames]);
}

export const NODE_PATH_METHODS: Readonly<Record<string, MethodPort>> = {
  is_absolute: port([], (path) => variant('BOOL', path.absolute)),
  get_name_count: port([], (path) => int(path.names.length)),
  get_name: port(['int32_t'], (path, args) => name(path.names[args[0] as number] ?? '')),
  get_subname_count: port([], (path) => int(path.subnames.length)),
  hash: port([], (path) => int(hash(path))),
  get_subname: port(['int32_t'], (path, args) => name(path.subnames[args[0] as number] ?? '')),
  get_concatenated_names: port([], (path) => name(concatenatedNames(path))),
  get_concatenated_subnames: port([], (path) => name(concatenatedSubnames(path))),
  slice: port(['int32_t', 'int32_t'], (path, args) => sliced(path, args[0] as number, args[1] as number)),
  get_as_property_path: port([], propertyPath),
  is_empty: port([], (path) => variant('BOOL', isEmpty(path))),
};
