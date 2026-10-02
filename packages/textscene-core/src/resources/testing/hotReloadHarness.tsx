/**
 * A real `ResourceLoader` over files a test edits, and a probe that shows what a
 * mounted `useResource` consumer holds, for the **Dependency hot-reload** tests.
 * Test-only, like the rest of `testing/`.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { FileEventBus } from '../FileEventBus';
import { ResourceLoader } from '../ResourceLoader';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import type { ResourceProvider } from '../ResourceProvider';
import type { ResourceType } from '../ResourceEventBus';
import { useResource } from '../useResource';

/** Files a test edits, and per-path gates that hold the next read of a path. */
export class EditableProvider implements ResourceProvider {
  private readonly files = new Map<string, string | ArrayBuffer>();
  private readonly gates = new Map<string, Promise<void>>();
  private readonly openers = new Map<string, () => void>();

  write(path: string, data: string | ArrayBuffer): void {
    this.files.set(path, data);
  }

  remove(path: string): void {
    this.files.delete(path);
  }

  /** Holds the next read of `path` until `release(path)`. */
  hold(path: string): void {
    this.gates.set(path, new Promise((resolve) => this.openers.set(path, resolve)));
  }

  release(path: string): void {
    this.openers.get(path)?.();
    this.openers.delete(path);
  }

  async loadResource(path: string): Promise<string | ArrayBuffer | null> {
    const gate = this.gates.get(path);
    if (gate) {
      this.gates.delete(path);
      // The answer is the file as it was when the read began.
      const before = this.files.get(path) ?? null;
      await gate;
      return before;
    }
    return this.files.get(path) ?? null;
  }
}

export function createHotReloadHarness() {
  const provider = new EditableProvider();
  const fileEventBus = new FileEventBus(provider);
  const loader = new ResourceLoader(fileEventBus);
  loader.setProvider(provider);
  return { provider, fileEventBus, loader };
}

interface ProbeProps<T> {
  path: string;
  type: ResourceType;
  /** What the test compares: a short text drawn from the loaded value. */
  read: (value: T) => string;
}

function Probe<T>({ path, type, read }: ProbeProps<T>) {
  const result = useResource<T>(path, type);
  return (
    <div data-testid="probe">{result.status === 'loaded' ? read(result.value as T) : result.status}</div>
  );
}

/** Mounts one consumer of `path` and returns a reader of what it shows. */
export function mountProbe<T>(loader: ResourceLoader, props: ProbeProps<T>): () => string {
  render(
    <ResourceLoaderProvider loader={loader}>
      <Probe {...props} />
    </ResourceLoaderProvider>
  );
  return () => screen.getByTestId('probe').textContent ?? '';
}

export async function expectShown(shown: () => string, expected: string): Promise<void> {
  await waitFor(() => {
    if (shown() !== expected)
      throw new Error(`expected the consumer to show "${expected}", got "${shown()}"`);
  });
}

export function provide(loader: ResourceLoader, path: string): void {
  act(() => loader.provideFile(path));
}
