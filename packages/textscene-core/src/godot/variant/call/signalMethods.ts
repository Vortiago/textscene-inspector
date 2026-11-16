import { defaultValue } from '../value/defaultValue.js';
import { NIL, variant, type Variant, type VariantOf } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort, type VarargPort } from './methodPort.js';

/** `ERR_UNCONFIGURED` (error_list.h:50): `Signal::connect` without an Object (callable.cpp:542). */
const ERR_UNCONFIGURED = 3n;

// Every Signal here has object 0, so each method takes its branch for a null Object.
const port = (parameters: readonly MethodParameter[], body: (name: string) => Variant): MethodPort =>
  methodPort(parameters, (base) => body((base as VariantOf<'SIGNAL'>).value));

export const SIGNAL_METHODS: Readonly<Record<string, MethodPort>> = {
  is_null: port([], (name) => variant('BOOL', name === '')),
  get_object: port([], () => defaultValue('OBJECT')),
  get_object_id: port([], () => variant('INT', 0n)),
  get_name: port([], (name) => variant('STRING_NAME', name)),
  connect: port(['CALLABLE', 'uint32_t'], () => variant('INT', ERR_UNCONFIGURED)),
  disconnect: port(['CALLABLE'], () => NIL),
  is_connected: port(['CALLABLE'], () => variant('BOOL', false)),
  get_connections: port([], () => variant('ARRAY', [])),
  has_connections: port([], () => variant('BOOL', false)),
};

export const SIGNAL_VARARG_METHODS: Readonly<Record<string, VarargPort>> = {
  emit: () => ({ value: NIL, isValid: true }),
};
