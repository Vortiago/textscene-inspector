# Which 2D draws pass the vertex-colour cast

`vertexColorQuantize.ts` reproduces the `uint8_t` cast of a Polygon2D fill colour. Only Polygon2D
fills pass this cast. Every cite is Godot 4.6.3 source.

- ColorRect keeps a float modulate (`drivers/gles3/rasterizer_canvas_gles3.h:212`).
- Line2D uploads GL_FLOAT colours (`drivers/gles3/rasterizer_canvas_gles3.cpp:2467-2469`).
