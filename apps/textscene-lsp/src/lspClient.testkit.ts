/**
 * A minimal LSP client for the end-to-end tests: it spawns the built server, frames JSON-RPC with
 * Content-Length headers, pairs each response with its request by id, and keeps every
 * notification so a test can wait for one that already arrived.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(packageDir, '../..');
const serverPath = join(packageDir, 'dist', 'server.js');

/** The command that builds `serverPath`, which each end-to-end file runs once in `beforeAll`. */
export const BUILD_SERVER_COMMAND = 'pnpm --filter @textscene/lsp build';

/** The blank line that ends a JSON-RPC header. */
const HEADER_END = '\r\n\r\n';

export interface RpcMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

interface Pending {
  resolve: (message: RpcMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Notification {
  readonly method: string;
  readonly params: unknown;
}

interface Waiter {
  readonly matches: (notification: Notification) => boolean;
  readonly resolve: (params: unknown) => void;
  readonly reject: (error: Error) => void;
}

export class LspClient {
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly notifications: Notification[] = [];
  private readonly waiters: Waiter[] = [];

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', (chunk: Buffer) => this.read(chunk));
    child.on('exit', (code) => this.failAll(new Error(`server exited with code ${code}`)));
    child.on('error', (error) => this.failAll(error));
  }

  /** Resolves with the next `method` notification, or one already received. */
  waitForNotification(method: string, timeoutMs = 5000): Promise<unknown> {
    return this.waitFor(method, () => true, timeoutMs);
  }

  /** Resolves with the params of the first `method` notification that `accept` takes, received or still to come. */
  waitFor(method: string, accept: (params: unknown) => boolean, timeoutMs = 5000): Promise<unknown> {
    const matches = (notification: Notification) =>
      notification.method === method && accept(notification.params);
    const existing = this.notifications.find(matches);
    if (existing) return Promise.resolve(existing.params);
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        matches,
        resolve: (params) => {
          clearTimeout(timer);
          resolve(params);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      // A waiter that timed out leaves the list, so a later notification reaches a live one.
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error(`no matching ${method} within ${timeoutMs}ms`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  request(method: string, params: unknown, timeoutMs = 10_000): Promise<RpcMessage> {
    const id = this.nextId++;
    this.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    return new Promise<RpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`no response to ${method} within ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  /** The `result` of a request, or a thrown error that names the method when the server answers with one. */
  async result<T>(method: string, params: unknown): Promise<T> {
    const response = await this.request(method, params);
    if (response.error !== undefined) {
      throw new Error(`${method} failed: ${JSON.stringify(response.error)}`);
    }
    return response.result as T;
  }

  notify(method: string, params: unknown): void {
    this.write(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }

  private write(payload: string): void {
    const body = Buffer.from(payload, 'utf8');
    this.child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.child.stdin.write(body);
  }

  private read(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf(HEADER_END);
      if (headerEnd === -1) return;
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1] ?? NaN);
      const bodyStart = headerEnd + HEADER_END.length;
      if (Number.isNaN(length)) {
        this.buffer = this.buffer.subarray(bodyStart);
        continue;
      }
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString('utf8');
      this.buffer = this.buffer.subarray(bodyStart + length);
      this.deliver(JSON.parse(body) as RpcMessage);
    }
  }

  private deliver(message: RpcMessage): void {
    // A request from the server, such as `client/registerCapability`, gets an empty result, and a
    // test waits for it as for a notification.
    if (typeof message.method === 'string' && message.id !== undefined) {
      this.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: null }));
      this.onNotification({ method: message.method, params: message.params });
      return;
    }
    if (typeof message.id !== 'number') {
      if (typeof message.method === 'string')
        this.onNotification({ method: message.method, params: message.params });
      return;
    }
    const pending = this.pending.get(message.id);
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    pending.resolve(message);
  }

  private onNotification(notification: Notification): void {
    this.notifications.push(notification);
    const index = this.waiters.findIndex((waiter) => waiter.matches(notification));
    if (index !== -1) this.waiters.splice(index, 1)[0]!.resolve(notification.params);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }
}

/** Spawns the built server over stdio. The caller kills the process when the test ends. */
export function spawnServer(): { child: ChildProcessWithoutNullStreams; client: LspClient } {
  const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  return { child, client: new LspClient(child) };
}

/**
 * Runs `use` against a fresh server that has completed the initialize handshake with
 * `rootUri` and the client `capabilities`, then shuts it down. A fresh server per test keeps the server's per-root
 * listing cache from leaking between tests.
 */
export async function withInitializedServer(
  rootUri: string | null,
  use: (client: LspClient) => Promise<void>,
  capabilities: Record<string, unknown> = {}
): Promise<void> {
  const { child, client } = spawnServer();
  try {
    await client.result('initialize', { processId: process.pid, rootUri, capabilities });
    client.notify('initialized', {});
    await use(client);
    await client.request('shutdown', null);
    client.notify('exit', null);
  } finally {
    child.kill();
  }
}
