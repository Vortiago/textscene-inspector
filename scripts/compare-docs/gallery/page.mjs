/**
 * The document the gallery ships as.
 */

import { JS } from './client.mjs';
import { CSS } from './styles.mjs';

/**
 * A standalone document for the repo or website, or under `fragment` only the
 * page content: an Artifact publish supplies its own doctype, head and body.
 */
export function page(nav, panels, firstType, fragment) {
  const body = `<aside class="side">
  <div class="brand"><span class="dot"></span>Render comparison</div>
  <input id="search" type="search" placeholder="Filter nodes…" aria-label="Filter nodes">
  <nav>${nav}</nav>
</aside>
<main id="main">${panels}</main>
<script>const FIRST=${JSON.stringify(firstType ?? null)};${JS}</script>`;
  if (fragment) {
    return `<title>Godot ⇄ TextScene — render comparison</title>\n<style>${CSS}</style>\n${body}`;
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Godot ⇄ TextScene — render comparison</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
