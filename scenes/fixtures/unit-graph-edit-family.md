# The GraphEdit fixture family

The `unit-graph-edit-*.tscn` fixtures each move one GraphEdit property. They share one GraphEdit
rect and one GraphNode.

Only `unit-graph-edit-scroll-offset-clamped.tscn` authors `scroll_offset`. `set_scroll_offset`
clamps against bounds that no child has widened while properties apply (graph_edit.cpp:407). An
authored offset therefore moves the grid, the nodes and the minimap camera together, and masks the
one variable each fixture moves.
