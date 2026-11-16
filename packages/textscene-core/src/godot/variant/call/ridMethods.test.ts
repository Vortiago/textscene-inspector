import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant';
import type { MethodContext } from './methodPort';
import { RID_METHODS } from './ridMethods';

const NO_CONTEXT = {} as MethodContext;
const rid = (id: bigint) => variant('RID', id);

describe('RID_METHODS', () => {
  it('is valid for a non-zero id', () => {
    expect(RID_METHODS.is_valid!.run(rid(5n), [], NO_CONTEXT)).toEqual(variant('BOOL', true));
  });

  it('is not valid for id 0', () => {
    expect(RID_METHODS.is_valid!.run(rid(0n), [], NO_CONTEXT)).toEqual(variant('BOOL', false));
  });

  it('reads the largest uint64 id as the int64 -1, as GDScript does', () => {
    expect(RID_METHODS.get_id!.run(rid(2n ** 64n - 1n), [], NO_CONTEXT)).toEqual(variant('INT', -1n));
  });
});
