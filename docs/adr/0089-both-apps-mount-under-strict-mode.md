# Both apps mount under StrictMode

- Status: Accepted.

## Context

React's `<StrictMode>` acts only in a development build. It renders each component twice, and it
runs each mount effect, its cleanup and the effect again. A render or effect with a side effect it
does not undo then shows twice: a second listener, a second scene, a second WebGL context.

## Decision

- The web previewer (`r3f-main.tsx`) and the VS Code webview (`r3f-webview-main.tsx`) mount their app
  under `<StrictMode>`.
- The web app's unit tests render under StrictMode too (`configure({ reactStrictMode: true })` in
  `test-setup.ts`). The webview's tests mount the real entry.
- A render has no side effect. An object that lives as long as the page, such as the webview's one
  scene and its provider, is made by the entry, outside React.
- A test mock fails by state, not by call count, since a mount effect may run twice.

## Consequences

- The VS Code integration suite builds the webview without `--production`, so it runs React's
  development build and exercises StrictMode. The web E2E gate and the visual gate serve a
  production build, where StrictMode does nothing.
- The webview's `WebviewResourceProvider` listens on the window for the life of the page and has no
  `dispose()`. The entry builds it once, so nothing needs to release it.
- A host can receive `webviewReady` twice on mount in a development build. On each one the host
  replays the scene text and the visibility, and resets its copy of the capture state. The webview
  posts its capture state after each one, so the second one changes nothing.
