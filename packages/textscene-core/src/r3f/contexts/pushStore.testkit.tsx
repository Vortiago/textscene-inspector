/** Test-only: a push store as a provider hands it to its readers, since `createPushStore` is private. */
import { renderHook } from '@testing-library/react';
import { createPushStoreContext, type PushStore } from './pushStore';

export function newPushStore<T>(): PushStore<T> {
  const { Provider, useStore } = createPushStoreContext<T>('TestPushStore');
  return renderHook(useStore, { wrapper: Provider }).result.current;
}
