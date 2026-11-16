import { variant, type Variant, type VariantOf } from '../value/variant.js';
import { methodPort, type MethodPort } from './methodPort.js';

const idOf = (base: Variant) => (base as VariantOf<'RID'>).value;

export const RID_METHODS: Readonly<Record<string, MethodPort>> = {
  is_valid: methodPort([], (base) => variant('BOOL', idOf(base) !== 0n)),
  get_id: methodPort([], (base) => variant('INT', BigInt.asIntN(64, idOf(base)))),
};
