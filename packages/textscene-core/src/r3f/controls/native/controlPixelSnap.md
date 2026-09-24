# Control pixel snap

`controlPixelSnap.ts` ports Godot's whole-pixel snap for a Control's drawn transform, from
`Control::_update_canvas_item_transform()` in `scene/gui/control.cpp`:

```cpp
Transform2D xform = _get_internal_transform();
xform[2] += get_position();
if (is_inside_tree() && Math::abs(Math::sin(data.rotation * 4.0f)) < 0.00001f
        && get_viewport()->is_snap_controls_to_pixels_enabled()) {
    xform[2] = (xform[2] + Vector2(0.5, 0.5)).floor();
}
```

1. The snap lands on the canvas item, never on the rect. `get_rect()` and the layout above it,
   such as the `GROW_DIRECTION_BOTH` halving (`control.cpp:1789-1797`), stay unsnapped, so the
   solve never reads a rounded number.
2. It snaps the composite translation: the internal transform's column plus the position. Godot
   4.6.3 draws a ColorRect at (100, 100) with `pivot_offset = (10.25, 10.25)` and
   `scale = (2, 2)` at exactly 90, `floor(100 + (10.25 - 20.5) + 0.5)`, not at 89.75.
3. The rotation test passes only at multiples of 45° (`SNAP_ROTATION_EPSILON`).

Each CanvasItem snaps its own parent-relative transform, so a fractionally placed parent leaves
its child fractional. The nested groups reproduce that.
