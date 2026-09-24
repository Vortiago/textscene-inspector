# Control clipping

`controlClipping.tsx` holds the accumulated canvas clip for the native Control canvas.

## Planes, not stencil

The 2D `<Canvas>` in `World2DCanvas.tsx` requests no stencil buffer, and three defaults it off, so
a stencil clip would do nothing. Planes are per-material state, so every leaf material spreads
`useControlClipPlanes`, as `controlQuad.tsx` and `StyleBoxQuad.tsx` do.

## A rect first, planes second

The clip is a rect first and planes second, because Godot's is. A clipping canvas item resolves
to one `final_clip_rect`, and that rect alone becomes the scissor
(`servers/rendering/renderer_canvas_cull.cpp:412-424`):

```cpp
if (p_canvas_clip != nullptr) {
    ci->final_clip_rect = p_canvas_clip->final_clip_rect.intersection(global_rect);
} else {
    ci->final_clip_rect = p_clip_rect.intersection(global_rect);
}
if (ci->final_clip_rect.size.width < 0.5 || ci->final_clip_rect.size.height < 0.5) {
    return;
}
ci->final_clip_rect.position = ci->final_clip_rect.position.round();
ci->final_clip_rect.size = ci->final_clip_rect.size.round();
```

1. A nested clip intersects the enclosing rect, then rounds, so a chain is one rect. The context
   carries the rect, because a narrowed plane set cannot be rounded.
2. Position and size round separately, so `round(pos) + round(size)` differs from
   `round(pos + size)` at a fractional origin. The pixel snap (`controlPixelSnap.ts`) keeps most
   origins whole.
3. The `< 0.5` early-out needs no code: the size rounds to zero, and a zero-size rect's planes
   keep no fragment below it.

`Control::clip_contents` clips to `Rect2(Point2(), get_size())` and ignores any scrollbar
(`scene/gui/control.cpp:3948`).

## Not modelled

Godot intersects the root with the viewport (`p_clip_rect`). That matters only for a clipper
outside the viewport at a fractional origin. A rotated clipper scissors its AABB in Godot
(`Transform2D::xform(Rect2)`), but here it keeps its rotated planes and skips quantisation.
