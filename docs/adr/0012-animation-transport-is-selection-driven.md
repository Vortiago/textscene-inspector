# Animation transport is selection-driven, one player at a time

The Animation dock tab binds to the **AnimationPlayer currently selected in the scene tree**, not to a single globally-registered player or to a list of all players. Selecting an AnimationPlayer node shows the tab and its clips. Selecting any other node hides the tab and stops playback, which restores the authored pose. Each AnimationPlayer Component compares its own `useNodePath()` to `SelectionContext.selectedNodePath` to decide whether it is the active player. Only the active one registers its clips with the `AnimationTransportContext` and advances its mixer. The rest stay inert.

This mirrors the **Godot editor**, whose Animation panel is selection-driven. It opens on the selected AnimationPlayer, has no in-panel player picker and offers no whole-scene animation view. Selection-driven playback keeps at most one player affecting the scene.

Rejected: a panel that lists every AnimationPlayer with independent transports. It diverges from Godot, multiplies UI for the common single-player case, and lets several players animate the scene at once.

## Consequences

- The tab appears only while an AnimationPlayer is selected, which also keeps the fixed tab bar uncrowded. It activates on selection.
- A selection change rebinds the transport to the new player and resets it (stopped, authored pose). The `autoplay` clip is pre-selected, else the first non-`RESET` clip. `RESET` is listed but never the default.
- A user inspects several AnimationPlayers in one scene by selecting each in turn, never at the same time.
