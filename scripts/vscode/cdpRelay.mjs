/**
 * A local relay between Playwright and a VS Code whose CDP endpoint refuses a call
 * Playwright makes as it attaches. VS Code 1.85 (Electron 25, Chromium 114) answers
 * `Browser.setDownloadBehavior` with "Browser context management is not supported",
 * and Playwright then drops the connection. The relay answers that call itself and
 * passes every other message through unchanged.
 */
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

/**
 * The calls the relay answers with an empty result. The driver never downloads a
 * file, so where VS Code saves one does not matter.
 */
const ANSWERED_METHODS = new Set(['Browser.setDownloadBehavior']);

/** The error text by which `connectOverCDP` names a refused attach call. */
export function isRefusedAttachCall(error) {
  return [...ANSWERED_METHODS].some((method) => String(error?.message ?? error).includes(method));
}

/**
 * The reply the relay sends for a client message, or `null` to forward it.
 *
 * @param {string} text one CDP message from Playwright
 * @returns {string | null}
 */
export function relayReply(text) {
  const message = JSON.parse(text);
  if (!ANSWERED_METHODS.has(message.method)) return null;
  return JSON.stringify({ id: message.id, sessionId: message.sessionId, result: {} });
}

/**
 * Points every URL in a `/json/*` discovery body at the relay, so the WebSocket
 * Playwright opens next reaches the relay and not VS Code.
 */
export function rewriteDiscovery(body, upstreamPort, relayPort) {
  return body.replace(
    new RegExp(`(127\\.0\\.0\\.1|localhost):${upstreamPort}\\b`, 'g'),
    `127.0.0.1:${relayPort}`
  );
}

function pipeSocket(client, upstreamUrl) {
  const upstream = new WebSocket(upstreamUrl, { perMessageDeflate: false });
  const pending = [];
  upstream.on('open', () => pending.splice(0).forEach((text) => upstream.send(text)));
  client.on('message', (data) => {
    const text = data.toString();
    const reply = relayReply(text);
    if (reply) client.send(reply);
    else if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
    else pending.push(text);
  });
  upstream.on('message', (data) => client.send(data.toString()));
  upstream.on('close', () => client.close());
  upstream.on('error', () => client.close());
  client.on('close', () => upstream.close());
}

/**
 * Starts the relay on a free port in front of the CDP endpoint on `upstreamPort`.
 *
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startCdpRelay(upstreamPort) {
  let relayPort;
  const server = http.createServer(async (request, response) => {
    try {
      const upstream = await fetch(`http://127.0.0.1:${upstreamPort}${request.url}`);
      const body = rewriteDiscovery(await upstream.text(), upstreamPort, relayPort);
      response.writeHead(upstream.status, { 'content-type': 'application/json' });
      response.end(body);
    } catch (error) {
      response.writeHead(502);
      response.end(`CDP relay could not reach port ${upstreamPort}: ${error}`);
    }
  });
  const sockets = new WebSocketServer({ server, perMessageDeflate: false });
  sockets.on('connection', (client, request) =>
    pipeSocket(client, `ws://127.0.0.1:${upstreamPort}${request.url}`)
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  relayPort = server.address().port;
  return {
    port: relayPort,
    close: () =>
      new Promise((resolve) => {
        for (const client of sockets.clients) client.terminate();
        sockets.close();
        server.close(() => resolve());
      }),
  };
}
