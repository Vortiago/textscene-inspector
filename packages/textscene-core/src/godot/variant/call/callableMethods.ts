import { defaultValue } from '../value/defaultValue.js';
import { NIL, variant, type CallableValue, type Variant, type VariantOf } from '../value/variant.js';
import { variantCallable, variantHash } from '../variantHash.js';
import { builtinMethodRow } from './builtinMethod.js';
import { methodPort, type MethodParameter, type MethodPort, type VarargPort } from './methodPort.js';
import type { CastArgument } from '../utility/utilityArguments.js';

const int = (value: number): Variant => variant('INT', BigInt(value));
const bool = (value: boolean): Variant => variant('BOOL', value);
const callable = (value: CallableValue): Variant => variant('CALLABLE', value);
const FAILED = { value: NIL, isValid: false };

const port = (
  parameters: readonly MethodParameter[],
  body: (base: CallableValue, args: readonly CastArgument[]) => Variant
): MethodPort => methodPort(parameters, (base, args) => body((base as VariantOf<'CALLABLE'>).value, args));

const elementsOf = (argument: CastArgument) => (argument as VariantOf<'ARRAY'>).value;

/** `Callable::is_valid` (callable.cpp:152): a standard Callable has no Object here. */
export function isValidCallable(value: CallableValue): boolean {
  switch (value.kind) {
    case 'standard':
      return false;
    case 'variant':
      return builtinMethodRow(value.base.type, value.method) !== undefined;
    default:
      return isValidCallable(value.callable);
  }
}

function methodOf(value: CallableValue): string {
  return value.kind === 'standard' || value.kind === 'variant' ? value.method : methodOf(value.callable);
}

/** `Callable::get_argument_count` (callable.cpp:187): the count, or nothing where it is not valid. */
function argumentCount(value: CallableValue): number | undefined {
  switch (value.kind) {
    case 'standard':
      return undefined;
    case 'variant':
      return builtinMethodRow(value.base.type, value.method)?.[4].length;
    case 'bind': {
      const count = argumentCount(value.callable);
      return count === undefined ? undefined : count - value.binds.length;
    }
    case 'unbind': {
      const count = argumentCount(value.callable);
      return count === undefined ? undefined : count + value.count;
    }
  }
}

/** `get_bound_arguments` of `CallableCustomBind` (callable_bind.cpp:120): new binds before the inner ones. */
function boundArguments(value: CallableValue): readonly Variant[] {
  if (value.kind === 'unbind') return boundArguments(value.callable);
  if (value.kind !== 'bind') return [];
  const added = value.binds.length - unboundCount(value.callable);
  return added <= 0
    ? boundArguments(value.callable)
    : [...value.binds.slice(0, added), ...boundArguments(value.callable)];
}

function unboundCount(value: CallableValue): number {
  if (value.kind === 'bind') return Math.max(0, unboundCount(value.callable) - value.binds.length);
  if (value.kind === 'unbind') return unboundCount(value.callable) + value.count;
  return 0;
}

/** `Callable::create` (callable.cpp:378): null and an Object make a standard Callable. */
function create(target: Variant, method: string): Variant {
  if (method === '') return defaultValue('CALLABLE');
  if (target.type === 'NIL' || target.type === 'OBJECT') return callable({ kind: 'standard', method });
  return variantCallable(target, method);
}

/** `Callable::bindv` (callable.cpp:134): an empty Array binds nothing and gives the same Callable. */
function bindv(value: CallableValue, binds: readonly Variant[]): Variant {
  return callable(binds.length === 0 ? value : { kind: 'bind', callable: value, binds: [...binds] });
}

/** `Callable::unbind` (callable.cpp:147): a count below 1 gives the same Callable. */
function unbind(value: CallableValue, count: number): Variant {
  return callable(count <= 0 ? value : { kind: 'unbind', callable: value, count });
}

export const CALLABLE_METHODS: Readonly<Record<string, MethodPort>> = {
  create: methodPort(['Variant', 'STRING_NAME'], (_, args) =>
    create(args[0] as Variant, (args[1] as Variant).value as string)
  ),
  // `Callable::callv` (callable.cpp:73) drops the call error.
  callv: methodPort(
    ['ARRAY'],
    (base, args, context) => context.callp((base as VariantOf<'CALLABLE'>).value, elementsOf(args[0]!)).value
  ),
  is_null: port([], (value) => bool(value.kind === 'standard' && value.method === '')),
  is_custom: port([], (value) => bool(value.kind !== 'standard')),
  is_standard: port([], (value) => bool(value.kind === 'standard' && value.method !== '')),
  is_valid: port([], (value) => bool(isValidCallable(value))),
  get_object: port([], () => defaultValue('OBJECT')),
  get_object_id: port([], () => int(0)),
  get_method: port([], (value) => variant('STRING_NAME', methodOf(value))),
  get_argument_count: port([], (value) => int(argumentCount(value) ?? 0)),
  get_bound_arguments_count: port([], (value) => int(boundArguments(value).length)),
  get_bound_arguments: port([], (value) => variant('ARRAY', [...boundArguments(value)])),
  get_unbound_arguments_count: port([], (value) => int(unboundCount(value))),
  hash: methodPort([], (base) => int(variantHash(base))),
  bindv: port(['ARRAY'], (value, args) => bindv(value, elementsOf(args[0]!))),
  unbind: port(['int32_t'], (value, args) => unbind(value, args[0] as number)),
};

const callableOf = (base: Variant) => (base as VariantOf<'CALLABLE'>).value;

// Each rpc reaches an Object, a VariantCallable's `CallableCustom::rpc`, or too few arguments: a call error.
const rpc: VarargPort = () => FAILED;

export const CALLABLE_VARARG_METHODS: Readonly<Record<string, VarargPort>> = {
  call: (base, args, context) => context.callp(callableOf(base), args),
  // `call_deferred` queues the call for the next idle frame, after the condition has its value.
  call_deferred: () => ({ value: NIL, isValid: true }),
  rpc,
  rpc_id: rpc,
  bind: (base, args) => ({
    value: callable({ kind: 'bind', callable: callableOf(base), binds: [...args] }),
    isValid: true,
  }),
};
