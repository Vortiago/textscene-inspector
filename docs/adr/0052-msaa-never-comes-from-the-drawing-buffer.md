# MSAA never comes from the drawing buffer

- Status: Accepted
- Related: ADR-0025 (the preview environment that mounts the compositor), ADR-0033 (SubViewport passes).

## Context

Godot's `msaa_2d` and `msaa_3d` default to Disabled (`rendering_server.cpp:3773-3774`). A project
setting turns them on for the root viewport (`scene_tree.cpp:2079-2083`), and a Viewport property
turns them on for a SubViewport. Godot draws 2X, 4X or 8X, or the closest lower count the device
supports (`rendering_device_driver_vulkan.cpp:1998-2015`). It resolves the 3D buffer in linear HDR,
before the tonemap pass (`render_forward_clustered.cpp:2402`, `:2514`).

A WebGL context's `antialias` flag multisamples the drawing buffer at a count the browser picks.
The resolve then averages the encoded, tone-mapped output, and a context cannot change the flag
after creation.

## Decision

Both canvases create their context with `antialias: false`. Each MSAA path draws into a render
target at the count Godot would draw on this device (`r3f/multisampledTarget.ts`). Godot keeps the
counts that the colour and the depth attachments both support, for the format each really has
(`rendering_device_driver_vulkan.cpp:1999`). So the module takes the colour storage from the target's
own texture, as three allocates it. The MSAA paths are these:

- The root viewport's `msaa_3d` multisamples the compositor's scene buffer, so it resolves in linear
  HDR before `GodotToneMapEffect` applies the curve. The compositor mounts for MSAA alone.
- The root viewport's `msaa_2d` draws the 2D canvas through a multisampled RGBA8 target that stores
  sRGB-encoded values, so items blend as they blend on the drawing buffer
  (`Canvas2DStage/canvasFrame.ts`). The same target draws the canvas with `msaa_2d` off, with one
  sample (ADR-0057).
- A 3D root with no valid Environment (ADR-0025) mounts `NoEnvironmentLayer`: the project's clear
  colour (`renderer_viewport.cpp:371`), and a compositor for `msaa_3d` with Godot's default LINEAR
  curve (`tone_mapper.h:177`). The 3D canvas is `flat`, so three adds no curve of its own.
- A SubViewport's `msaa_3d` multisamples the linear HDR buffer its 3D pass draws into, which
  resolves before its own tonemap pass writes the target (`r3f/environment/offscreenToneMap.ts`).
  Its `msaa_2d` multisamples the frame its canvas draws through. Godot takes `msaa_3d` for the 3D
  buffers (`renderer_viewport.cpp:173`, `:278`) and `msaa_2d` for the render target (`:1362`).
- The compositor draws only the root world, because it draws to the canvas. A WorldEnvironment in
  a SubViewport's own world mounts none, and its tone curve stays off the shared renderer. The
  SubViewport's tonemap pass reads that Environment instead.

## Consequences

The screenshot renders one frame of the canvas's loop, because a pass that owns the render draws
what the canvas shows.
