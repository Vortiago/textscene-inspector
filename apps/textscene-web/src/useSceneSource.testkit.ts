/**
 * Shared scaffolding for the `useSceneSource.*.test.ts` suites: TSCN texts, and helpers that
 * decide when a fetch resolves and a debounce fires. Not `.test.ts`, so vitest skips it.
 * `vi.mock('./sourceGate')` is hoisted per module graph, so each suite declares its own.
 */
import { act } from '@testing-library/react';
import { vi } from 'vitest';

export const FIXTURE_TSCN = `[gd_scene load_steps=1 format=3]

[node name="FixtureRoot" type="Node3D"]
`;

export const SECOND_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SecondRoot" type="Node3D"]
`;

export const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]
`;

export const VALID_EDIT_TSCN = `[gd_scene load_steps=1 format=3]

[node name="EditedRoot" type="Node3D"]
`;

export const GARBAGE = 'not valid tscn at all }{ ]] [[';

/** Manually-resolved deferred so tests can control when a fetch resolves. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function mockFetchOk(text: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(text),
  } as unknown as Response) as unknown as typeof fetch;
}

export function mockFetchFail() {
  return vi.fn().mockResolvedValue({
    ok: false,
    statusText: 'Not Found',
  } as unknown as Response) as unknown as typeof fetch;
}

/** Not Found until `recover()`, by state, not by call count: StrictMode fetches twice on mount. */
export function mockRecoveringServer(text: string, isServed: (url: string) => boolean = () => true) {
  let isUp = false;
  let fetchCount = 0;
  const [served, notFound] = [mockFetchOk(text), mockFetchFail()];
  const fetch = vi.fn((...args: Parameters<typeof globalThis.fetch>) => {
    if (!isServed(String(args[0]))) return notFound(...args);
    fetchCount += 1;
    return (isUp ? served : notFound)(...args);
  });
  return {
    fetch: fetch as unknown as typeof globalThis.fetch,
    recover: () => {
      isUp = true;
    },
    fetchCount: () => fetchCount,
  };
}

/** Let real time pass so a debounce timer fires. */
export async function settle(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
