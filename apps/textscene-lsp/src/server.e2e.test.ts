/**
 * One end-to-end JSON-RPC smoke test: build the server bundle, spawn it, and speak LSP over
 * its stdio. It initializes, opens a scene, then asks for a hover and the scene's symbols,
 * which proves the framing, the capability wiring and the feature handlers all connect.
 */

import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const serverPath = join(packageDir, 'dist', 'server.js');
const SCENE_URI = 'file:///scene.tscn';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]
visible = true
`;

interface RpcMessage {
  id?: number;
  method?: string;
  result?: unknown;
  error?: unknown;
}

interface Pending {
  resolve: (message: RpcMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** A minimal LSP client: Content-Length framing, request/response by id, notifications one way. */
class LspClient {
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', (chunk: Buffer) => this.read(chunk));
    child.on('exit', (code) => this.failAll(new Error(`server exited with code ${code}`)));
    child.on('error', (error) => this.failAll(error));
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
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1] ?? NaN);
      if (Number.isNaN(length)) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString('utf8');
      this.buffer = this.buffer.subarray(bodyStart + length);
      this.deliver(JSON.parse(body) as RpcMessage);
    }
  }

  private deliver(message: RpcMessage): void {
    if (typeof message.id !== 'number') return;
    const pending = this.pending.get(message.id);
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    pending.resolve(message);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

beforeAll(() => {
  execSync('pnpm --filter @textscene/lsp build', { cwd: repoRoot, stdio: 'pipe' });
}, 120_000);

describe('tscn-lsp end-to-end', () => {
  it('initializes, hovers a class and returns the scene tree over stdio', async () => {
    const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    const client = new LspClient(child);
    try {
      const initialize = await client.request('initialize', {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
      });
      const capabilities = (initialize.result as { capabilities: Record<string, unknown> }).capabilities;

      expect(capabilities.hoverProvider).toBe(true);
      expect(capabilities.completionProvider).toMatchObject({
        triggerCharacters: ['"', '=', '.', '/', '('],
      });
      expect(capabilities.codeActionProvider).toMatchObject({ codeActionKinds: ['quickfix'] });

      client.notify('initialized', {});
      client.notify('textDocument/didOpen', {
        textDocument: { uri: SCENE_URI, languageId: 'tscn', version: 1, text: SCENE },
      });

      const hover = await client.request('textDocument/hover', {
        textDocument: { uri: SCENE_URI },
        position: { line: 2, character: 26 },
      });
      const contents = (hover.result as { contents: { value: string } }).contents;

      expect(contents.value).toContain('Node3D');

      const symbols = await client.request('textDocument/documentSymbol', {
        textDocument: { uri: SCENE_URI },
      });
      const tree = symbols.result as Array<{ name: string; detail: string }>;

      expect(tree.map((symbol) => symbol.name)).toEqual(['Root']);
      expect(tree[0]!.detail).toBe('Node3D');

      await client.request('shutdown', null);
      client.notify('exit', null);
    } finally {
      child.kill();
    }
  }, 60_000);
});
