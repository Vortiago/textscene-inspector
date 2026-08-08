/**
 * The self-contained page suite A runs against. Served from a throwaway
 * `node:http` server so that suite needs no preview build at all — it is about
 * a BROWSER behaviour (SVG-as-image sub-resource loading), not about our app.
 */

import { createServer } from 'node:http';

const FIXTURE_HTML = `<!doctype html><meta charset="utf-8"><title>raster fixture</title>
<body style="margin:0;background:#000">
<div id="subtree" style="position:absolute;left:40px;top:24px;width:240px;height:160px;
     font-family:system-ui,sans-serif;font-size:16px;color:rgb(223,223,223)">
  <div id="text" style="position:absolute;left:8px;top:8px">GODOT CONTROL</div>
  <img id="blob-img" style="position:absolute;left:8px;top:40px;width:48px;height:48px">
  <div id="blob-bg" style="position:absolute;left:72px;top:40px;width:48px;height:48px;
       background-repeat:no-repeat;background-size:100% 100%"></div>
</div>
<div id="empty" style="position:absolute;left:0;top:0;width:0;height:0"></div>
</body>`;

/** Starts the fixture server on an ephemeral port; returns it and its URL. */
export async function startFixtureServer() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(FIXTURE_HTML);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, fixtureUrl: `http://127.0.0.1:${server.address().port}/` };
}
