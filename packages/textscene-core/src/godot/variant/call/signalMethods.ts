import { defaultValue } from '../value/defaultValue.js';
import { NIL, variant, type VariantOf } from '../value/variant.js';
import { ERROR_CODE } from './errorCode.js';
import { NIL_RESULT, type MethodPort, type VarargPort, portOn } from './methodPort.js';

// Every Signal here has object 0, so each method takes its branch for a null Object.
const port = portOn((base) => (base as VariantOf<'SIGNAL'>).value);

export const SIGNAL_METHODS: Readonly<Record<string, MethodPort>> = {
  is_null: port([], (name) => variant('BOOL', name === '')),
  get_object: port([], () => defaultValue('OBJECT')),
  get_object_id: port([], () => variant('INT', 0n)),
  get_name: port([], (name) => variant('STRING_NAME', name)),
  // `Signal::connect` without an Object (callable.cpp:542).
  connect: port(['CALLABLE', 'uint32_t'], () => variant('INT', ERROR_CODE.ERR_UNCONFIGURED)),
  disconnect: port(['CALLABLE'], () => NIL),
  is_connected: port(['CALLABLE'], () => variant('BOOL', false)),
  get_connections: port([], () => variant('ARRAY', [])),
  has_connections: port([], () => variant('BOOL', false)),
};

export const SIGNAL_VARARG_METHODS: Readonly<Record<string, VarargPort>> = {
  emit: () => NIL_RESULT,
};
