import { canConvertStrict, castVariant } from '../construct/variantCast.js';
import { textToVariant } from '../reader/variantReader.js';
import { castArgument, isCppParameter, type CastArgument } from '../utility/utilityArguments.js';
import type { UtilityHost } from '../utility/utilityHost.js';
import { NIL, type CallableValue, type Variant } from '../value/variant.js';
import { variantTypeOfName } from '../variantType.js';
import { builtinMethodRow } from './builtinMethod.js';
import { isValidCallable } from './callableMethods.js';
import type { MethodContext, MethodParameter, MethodResult } from './methodPort.js';
import { METHOD_PORTS, VARARG_PORTS } from './methodPorts.js';

const FAILED: MethodResult = { value: NIL, isValid: false };
const IS_VARARG = 4;

/** `VariantCaster<T>::cast`: the value the method runs with, also for an argument the check refused. */
const castMethodArgument = (argument: Variant, parameter: MethodParameter): CastArgument =>
  isCppParameter(parameter) ? castArgument(argument, parameter) : castVariant(argument, parameter);

/** Written only by `defaultArgument`: each default text of the extension API, read once. */
const defaults = new Map<string, Variant>();

function defaultArgument(text: string): Variant {
  let value = defaults.get(text);
  if (!value) defaults.set(text, (value = textToVariant(text)));
  return value;
}

// binder_common.h:172: Variant::can_convert_strict against the declared type, and a Variant takes any.
function isAccepted(argument: Variant, declared: string): boolean {
  const type = variantTypeOfName(declared);
  return type === undefined || canConvertStrict(argument.type, type);
}

/** A method a Callable calls that has no port yet. */
export class UnportedMethod extends Error {}

/** Nothing for a method with no port yet. A refused argument still runs the method on its cast value. */
export function callMethod(
  base: Variant,
  name: string,
  args: readonly Variant[],
  host: UtilityHost
): MethodResult | undefined {
  if (base.type === 'OBJECT') return FAILED;
  const row = builtinMethodRow(base.type, name);
  if (!row) return FAILED;
  const [, , flags, , declared] = row;
  // variant_call.cpp:1985: a vararg method checks its own arguments.
  if (flags & IS_VARARG) return VARARG_PORTS[base.type]?.[name]?.(base, args, methodContext(host));
  const required = declared.filter(([, defaultText]) => defaultText === undefined).length;
  if (args.length > declared.length || args.length < required) return FAILED;
  const port = METHOD_PORTS[base.type]?.[name];
  if (!port) return undefined;
  const filled = declared.map(([, defaultText], index) => args[index] ?? defaultArgument(defaultText!));
  const value = port.run(
    base,
    filled.map((argument, index) => castMethodArgument(argument, port.parameters[index]!)),
    methodContext(host)
  );
  return { value, isValid: filled.every((argument, index) => isAccepted(argument, declared[index]![0])) };
}

const methodContext = (host: UtilityHost): MethodContext => ({
  random: host.random,
  callp: (callable, args) => callp(callable, args, host),
});

/** `Callable::callp` (callable.cpp:43): a Callable with no valid target is a call error. */
function callp(callable: CallableValue, args: readonly Variant[], host: UtilityHost): MethodResult {
  if (!isValidCallable(callable)) return FAILED;
  switch (callable.kind) {
    case 'variant': {
      const result = callMethod(callable.base, callable.method, args, host);
      if (!result) throw new UnportedMethod(`the method ${callable.method}`);
      return result;
    }
    case 'bind':
      return callp(callable.callable, [...args, ...callable.binds], host);
    case 'unbind':
      if (args.length < callable.count) return FAILED;
      return callp(callable.callable, args.slice(0, args.length - callable.count), host);
    default:
      return FAILED;
  }
}
