import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { isRefusedAttachCall, relayReply, rewriteDiscovery, startCdpRelay } from './cdpRelay.mjs';

describe('relayReply', () => {
  it('answers the download call with an empty result for its session', () => {
    const call = JSON.stringify({
      id: 7,
      sessionId: 'S1',
      method: 'Browser.setDownloadBehavior',
      params: {},
    });

    expect(JSON.parse(relayReply(call))).toEqual({ id: 7, sessionId: 'S1', result: {} });
  });

  it('forwards every other call', () => {
    expect(relayReply(JSON.stringify({ id: 1, method: 'Target.setAutoAttach' }))).toBeNull();
  });

  it('throws on a message that is not JSON', () => {
    expect(() => relayReply('not json')).toThrow(SyntaxError);
  });
});

describe('rewriteDiscovery', () => {
  it('points the debugger URL at the relay', () => {
    const body = '{"webSocketDebuggerUrl": "ws://127.0.0.1:9464/devtools/browser/abc"}';

    expect(rewriteDiscovery(body, 9464, 40123)).toBe(
      '{"webSocketDebuggerUrl": "ws://127.0.0.1:40123/devtools/browser/abc"}'
    );
  });

  it('rewrites a localhost URL too', () => {
    expect(rewriteDiscovery('ws://localhost:9464/x', 9464, 40123)).toBe('ws://127.0.0.1:40123/x');
  });

  it('leaves a port that only starts with the upstream port alone', () => {
    expect(rewriteDiscovery('ws://127.0.0.1:94640/x', 9464, 40123)).toBe('ws://127.0.0.1:94640/x');
  });
});

describe('isRefusedAttachCall', () => {
  it('recognises the error Playwright raises for the refused call', () => {
    const error = new Error(
      'browserType.connectOverCDP: Protocol error (Browser.setDownloadBehavior): ' +
        'Browser context management is not supported.'
    );

    expect(isRefusedAttachCall(error)).toBe(true);
  });

  it('refuses an unrelated connection error', () => {
    expect(isRefusedAttachCall(new Error('connect ECONNREFUSED 127.0.0.1:9464'))).toBe(false);
  });

  it('refuses a missing error', () => {
    expect(isRefusedAttachCall(undefined)).toBe(false);
  });
});

/** A stand-in CDP endpoint that echoes each call back as its result. */
async function startEchoEndpoint() {
  const server = http.createServer((_request, response) => {
    const { port } = server.address();
    response.end(JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/x` }));
  });
  const sockets = new WebSocketServer({ server });
  sockets.on('connection', (socket) =>
    socket.on('message', (data) => {
      const { id, method } = JSON.parse(data.toString());
      socket.send(JSON.stringify({ id, result: { echoed: method } }));
    })
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    close: async () => {
      sockets.close();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

function call(socket, message) {
  return new Promise((resolve) => {
    socket.once('message', (data) => resolve(JSON.parse(data.toString())));
    socket.send(JSON.stringify(message));
  });
}

describe('startCdpRelay', () => {
  const closers = [];
  afterEach(async () => {
    for (const close of closers.splice(0).reverse()) await close();
  });

  async function connectThroughRelay() {
    const endpoint = await startEchoEndpoint();
    closers.push(endpoint.close);
    const relay = await startCdpRelay(endpoint.port);
    closers.push(relay.close);
    const version = await (await fetch(`http://127.0.0.1:${relay.port}/json/version`)).json();
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    closers.push(async () => socket.close());
    await new Promise((resolve) => socket.once('open', resolve));
    return { relay, version, socket };
  }

  it('hands out a debugger URL on the relay', async () => {
    const { relay, version } = await connectThroughRelay();

    expect(version.webSocketDebuggerUrl).toBe(`ws://127.0.0.1:${relay.port}/devtools/browser/x`);
  });

  it('forwards a call and returns the endpoint reply', async () => {
    const { socket } = await connectThroughRelay();

    expect(await call(socket, { id: 1, method: 'Target.getTargets' })).toEqual({
      id: 1,
      result: { echoed: 'Target.getTargets' },
    });
  });

  it('answers the download call without the endpoint', async () => {
    const { socket } = await connectThroughRelay();

    expect(await call(socket, { id: 2, method: 'Browser.setDownloadBehavior' })).toEqual({
      id: 2,
      result: {},
    });
  });

  it('answers 502 when the endpoint is gone', async () => {
    const endpoint = await startEchoEndpoint();
    await endpoint.close();
    const relay = await startCdpRelay(endpoint.port);
    closers.push(relay.close);

    const response = await fetch(`http://127.0.0.1:${relay.port}/json/version`);

    expect(response.status).toBe(502);
  });
});
