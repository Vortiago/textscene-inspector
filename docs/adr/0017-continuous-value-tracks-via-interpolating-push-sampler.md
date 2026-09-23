# Continuous value tracks drive through an interpolating push sampler (generalises ADR-0016)

A Godot `value` track can target a non-transform, *continuously interpolated* property, such as `Decal:modulate` (a colour fade) or `Decal:size` (a box that grows). It cannot go through the `THREE.AnimationMixer`, for the same reasons as the discrete `frame` track: ADR-0011 binds transforms only, and ADR-0016 rejected mutating THREE properties because the visual is React-state-derived and R3F does not repaint. So these ride the push path that ADR-0016 opened for `frame`, generalised. The active **AnimationPlayer** samples the value tracks of the clip at the live mixer playhead (`action.time`) and *pushes* the sampled value to the target component. The component overrides its authored value while a value is pushed and reverts on release.

Three things differ from the `frame`-only path:

- **The registry is generalised.** `AnimatedFrameContext` (a `number | null` setter keyed by node path) becomes the **AnimatedValue** registry: a `number[] | null` setter keyed by `${nodePath}:${property}`. The domain forces the composite key: one node animates several properties at once (a Decal fades `modulate` *and* grows `size`). `frame` moves onto it as a 1-tuple. Nothing else about the discrete `frame` path changes.
- **Sampling interpolates.** `frame` is sampled *stepped* (hold until the next key). Continuous values are sampled by **component-wise linear interpolation** between the two bracketing keyframes, honouring the `interp` mode of the track (0 = nearest/stepped, 1 = linear). The sampler implements this small interpolation itself rather than borrow the `KeyframeTrack` interpolants of THREE, because the value never reaches a THREE object. It is pushed into React state.
- **`size` is carried as a scale, not geometry.** The Decal renders **unit** box-edges and quad inside an inner group scaled by `size`, for both the static and the animated path. An animated `size` is then a cheap scale write instead of a rebuild (and dispose) of `EdgesGeometry`/`PlaneGeometry` about 60 times a second per decal.

Only the Godot 4 `Decal:size` property is driven, **not** the Godot 3 `Decal:extents` (half-size) name. Godot 4.0 removed `extents`, so no live Godot 4 scene carries it. One vendored demo, `scenes/demos/3d/decals/decal.tscn`, authored it. The corpus copy is corrected: both tracks retarget to `size` with the keyframe values doubled (`size = 2 × extents`). That beats a permanent version-compat alias in the resolver. `scenes/demos/README.md` documents the local corpus patch so a re-vendor applies it again.

## Considered options

- **Bind `modulate`/`size` on the THREE object of the target for the mixer to drive.** Rejected for the reason ADR-0016 rejected it for `frame`. R3F does not repaint on a non-React property mutation, and `size` to geometry and `modulate` to material colour are React-derived.
- **Reuse the `KeyframeTrack` interpolation of THREE by building an off-screen clip to read interpolated values.** Rejected. A mixer and clip used only as an interpolation calculator are heavier and less direct than a lerp of the two bracketing keys.
- **A discriminated-union payload (`{kind, value}`) instead of a bare `number[]`.** Rejected. Each consumer registers under a specific `(path, property)` and already knows the arity it expects. The tag adds verbosity at every push and consume site for no decoding benefit.

## Consequences

- **Cubic interpolation (`interp = 2`) and keyframe `transition` easing are approximated as linear.** A note in the sampler records the limit. `method` tracks and the `bezier`, `audio` and `animation` track types stay deferred.
- NodePath depth does not constrain this path. `resolveTargetNodePath` resolves the path of the track against the player's own, applying `..` and any number of named segments, and the registry is keyed by the resulting absolute node path. A value track therefore binds where a mixer-driven transform track, which depends on the name lookup of THREE inside the mixer root, does not (ADR-0011).
- Per-frame pushes stay cheap as in ADR-0016: the registry is ref-backed, so a push never re-renders consumers. Only the setter of the target component re-renders, and only while that target animates.
- Colour is interpolated in Godot's stored sRGB space. The consumer applies its own semantics to the result, identical to its static path: the Decal computes `opacity = albedo_mix × a` and converts RGB with `godotColorToLinear`.
- Playback stays non-deterministic over time, so animated-decal fixtures stay out of the visual-regression manifest. The stopped/authored pose stays byte-stable.
