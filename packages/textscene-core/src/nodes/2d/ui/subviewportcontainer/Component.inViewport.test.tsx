import { describe, expect, it } from 'vitest';
import { framesOf } from '../../../viewport/subviewport/viewportPasses.testkit';

import '../../../../r3f/nodes/index';
import '../../../../r3f/controls/index';

const IN_WINDOW = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Panel" type="Window" parent="."]
size = Vector2i(500, 380)

[node name="Container" type="SubViewportContainer" parent="Panel"]
offset_right = 400.0
offset_bottom = 300.0

[node name="Viewport" type="SubViewport" parent="Panel/Container"]
size = Vector2i(400, 300)

[node name="Back" type="Polygon2D" parent="Panel/Container/Viewport"]
polygon = PackedVector2Array(0, 0, 400, 0, 400, 300, 0, 300)
`;

const IN_SUBVIEWPORT = `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Outer" type="SubViewportContainer" parent="."]
offset_right = 500.0
offset_bottom = 400.0

[node name="SubViewport" type="SubViewport" parent="Outer"]
size = Vector2i(500, 400)

[node name="Inner" type="SubViewportContainer" parent="Outer/SubViewport"]
offset_right = 400.0
offset_bottom = 300.0

[node name="SubViewport" type="SubViewport" parent="Outer/SubViewport/Inner"]
size = Vector2i(400, 300)

[node name="Square" type="ColorRect" parent="Outer/SubViewport/Inner/SubViewport"]
offset_right = 100.0
offset_bottom = 100.0
`;

/** The names above each mesh the pass that draws `passScene` reaches in the second frame. */
async function reachedBy(tscn: string, passScene: string, enclosingPassIndex = 0): Promise<string[]> {
  const frames = await framesOf(tscn, 2);
  const draws = frames[1]!.filter((draw) => draw.scene.name === passScene);
  return draws[enclosingPassIndex]?.reached ?? [];
}

describe('a SubViewportContainer inside another viewport', () => {
  it('draws its viewport in an embedded Window', async () => {
    expect(await reachedBy(IN_WINDOW, 'Panel::control-raster')).toContain('SubViewportContainer:Container');
  });

  it('draws its viewport in a SubViewport', async () => {
    // Both viewports are named SubViewport, and the inner pass draws first.
    expect(await reachedBy(IN_SUBVIEWPORT, 'SubViewport::control-raster', 1)).toContain(
      'SubViewportContainer:Inner'
    );
  });
});
