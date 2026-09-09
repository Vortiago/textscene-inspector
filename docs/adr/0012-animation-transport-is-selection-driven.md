# Animation transport is selection-driven, one player at a time

The Animation dock tab binds to the **AnimationPlayer currently selected in the scene tree**. It does not bind to a single globally-registered player, nor to a list of all players at once. Selecting an AnimationPlayer node shows the tab and its clips. Selecting any other node hides the tab and stops playback, restoring the authored pose. Each AnimationPlayer Component compares its own `useNodePath()` to `SelectionContext.selectedNodePath` to decide whether it is the active player. Only the active one registers its clips with the `AnimationTransportContext` and advances its mixer. The rest stay inert.

We chose this to mirror the **Godot editor**, whose Animation panel is itself selection-driven. It opens on the selected AnimationPlayer, has no in-panel player picker, and offers no whole-scene animation view. The rejected alternative was a panel listing every AnimationPlayer with independent transports. It diverges from Godot, multiplies UI for the common single-player case, and would let several players animate the scene at once. Selection-driven keeps at most one player affecting the scene and matches what a Godot user expects.

## Consequences

- The tab appears only while an AnimationPlayer is selected (which also avoids crowding the fixed tab bar) and auto-activates on selection.
- Switching selection rebinds the transport to the new player and resets it (stopped, authored pose). The `autoplay` clip is pre-selected, else the first non-`RESET` clip. `RESET` is listed but never the default.
- Multiple AnimationPlayers in one scene are inspected by selecting each in turn, never simultaneously.
