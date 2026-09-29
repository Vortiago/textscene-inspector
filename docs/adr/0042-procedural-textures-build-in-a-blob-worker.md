# Procedural textures build in a blob-URL worker

- Status: Accepted.
- Amends: ADR-0034, ADR-0037 and ADR-0040. Each declined to widen the webview CSP for a
  runtime MSDF generator. This ADR opens `worker-src blob:` and nothing else, so their
  finding stands: MSDF generation also needs `connect-src`, which stays closed.
- Related: ADR-0031 (resource slices: the NoiseTexture2D slice owns the job).

## Context

The previewer rasterises a `NoiseTexture2D` on the main thread, inside the render that
first reads it. A 1024x1024 seamless field takes about a second, and the cost grows with
the pixel count, so a large texture freezes the tab.

Godot 4.6.3 does not cap the size. `set_width` and `set_height` refuse only a value of 0
or less (`modules/noise/noise_texture_2d.cpp:243`, `:252`). Godot builds a later change on
`noise_thread` and keeps the old texture until the new image is ready (`:132-139`). Only
the first build blocks (`:205`). So an off-thread build changes no pixel. It keeps the
previewer responsive.

The VS Code webview CSP is `default-src 'none'` with no `worker-src`, so a worker falls
back to `'none'`. VS Code webviews run a worker only from a `blob:` or `data:` URL: a
script from the extension's resource origin is cross-origin to the webview document.

## Decision

**A procedural texture builds in a Web Worker that each host starts from a `blob:` URL.**
The webview CSP gains `worker-src blob:` and nothing else.

- **The worker fetches nothing.** Each host bundles the worker as one self-contained
  script string and creates the blob from it. The job input arrives in a message, and the
  pixels return as a transferred buffer. So `connect-src`, `font-src` and `child-src`
  stay at `'none'`.
- **A blob worker runs only code the page itself creates.** Only the nonce'd entry and
  the extension's own chunks run in the page (`script-src`), so the directive admits no
  code that the page could not already run.
- **One job, three runners.** The job is a pure function in core. The worker runs it,
  and so does the in-thread fallback, which runs when a host gives no worker or the
  worker fails to start. The fallback is the synchronous build that existed before, so
  it gives the same bytes.

**A large texture uploads in bands, at the site that draws it.** A built texture still
reaches the GPU in one `texImage2D`, which took 34–435 ms for 4096² RGBA in headless
Chromium. So `r3f/tiledUpload/` allocates the storage empty and fills it in row bands,
within 8 ms a frame. The bytes read back identical to three's whole upload, at the base
level and through the mip chain. The tiling wraps the exact texture a consumer draws,
because three uploads each clone separately when its sampler or colour-space settings
differ, and the 2D canvas and the 3D material slots each draw such a clone. A slot keeps
drawing its previous texture until the new one is on the GPU.

## Measurement

The in-frame probe `scripts/vscode/probes/blobWorkerProbe.mjs` echoes one number through
a blob-URL worker. In Chromium 141, under a copy of the webview CSP:

| Policy | Echo | CSP violations |
|---|---|---|
| without `worker-src` | blocked | 1: `worker-src`, `blob` |
| with `worker-src blob:` | `42` | 0 |

## Consequences

- **The gate proves it at the real origin.** `pnpm test:vscode:csp` runs the probe inside
  the real VS Code webview and requires the echo, zero CSP violations and zero requests
  outside the local resource origin.
- **The web gate measures long tasks in a GPU-composited browser.** `pnpm test:e2e:web`
  opens a 4096x4096 seamless texture and requires no main-thread task over 50 ms. It
  counts each task that starts between the first attach and the last detach of the
  texture work status. The task that attaches the status mounts the scene and only
  queues the build. The default headless launch composites in software: it reads the
  canvas back every frame, and the main thread waits for all queued GPU work. Two costs
  of the GPU process then show as main-thread tasks:
  - a 50–69 ms clear of the empty level. WebGL's robust resource initialisation clears
    the whole level before the first band writes to it.
  - a 30–38 ms first draw that samples the texture.

  Those two arms run with `--use-angle=swiftshader`, which composites in the GPU
  process, as a browser with a GPU does. The goldens keep the default launch, because
  that backend rasterises differently (up to 59/255 on `material-metallic`). A control
  arm blocks the worker and must see a long task, so the probe proves it can see one.
- **A CSP regression cannot hide behind the fallback.** The in-thread fallback still
  draws correct pixels, so the pixels alone cannot show that the worker is gone. The
  gate asserts that the worker answered.
- **A `.tres` material's own texture uploads whole.** `loadMaterial` builds that material
  outside React, where no draw site wraps its maps, so three uploads such a texture in one
  call on its first draw.
- **Runtime MSDF generation stays closed.** It needs `connect-src` for its font fetch,
  which this ADR does not open.
