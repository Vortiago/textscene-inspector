import { it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { canvasPaintPass } from './canvasItemPaint';
import '../nodes/index';
it('debug', () => {
  const s = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]

[node name="Ball" type="Polygon2D" parent="."]
`);
  const p = canvasPaintPass(liveTreeOf(s.nodes, contextOver(s, {})));
  for (const [k, v] of p) console.log(k, v.own, JSON.stringify(v.range));
});
