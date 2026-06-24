# Continuous value tracks drive via an interpolating push sampler (generalises ADR-0016)

A Godot `value` track targeting a non-transform, *continuously interpolated* property — `Decal:modulate` (a colour fade), `Decal:size` (a box that grows) — can no more go through the `THREE.AnimationMixer` than the discrete `frame` track could (ADR-0011 binds transforms only; ADR-0016 rejected mutating THREE properties because the visual is React-state-derived and R3F won't repaint). So these ride the **same push path** ADR-0016 opened for `frame`, generalised: the active **AnimationPlayer** samples the clip's value tracks at the live mixer playhead (`action.time`) and *pushes* the sampled value to the target component, which overrides its authored value while a value is pushed and reverts on release. ADR-0016 explicitly anticipated this ("the registry generalises: other discrete properties (`modulate`, `visible`) and `Sprite3D` can ride the same push path later").

Three things change versus the `frame`-only path:

- **The registry is generalised.** `AnimatedFrameContext` (a `number | null` setter keyed by node path) becomes the **AnimatedValue** registry: a `number[] | null` setter keyed by `${nodePath}:${property}`. The composite key is forced by the domain — a single node animates several properties at once (a Decal fades `modulate` *and* grows `size`). `frame` migrates onto it as a 1-tuple; nothing else about the discrete `frame` path changes.
- **Sampling interpolates.** `frame` is sampled *stepped* (hold-until-next-key). Continuous values are sampled by **component-wise linear interpolation** between the two bracketing keyframes, honouring the track's `interp` mode (0 = nearest/stepped, 1 = linear). We re-implement this small interpolation rather than borrow THREE's `KeyframeTrack` interpolants, because the value never reaches a THREE object — it is pushed into React state.
- **`size` is carried as a scale, not geometry.** The Decal renders **unit** box-edges + quad inside an inner group scaled by `size`, for both the static and animated paths. Animating `size` is then a cheap scale write instead of rebuilding (and disposing) `EdgesGeometry`/`PlaneGeometry` ~60×/sec per decal.

We drive the Godot 4 `Decal:size` property only — **not** the legacy Godot 3 `Decal:extents` (half-size) name. `extents` was hard-removed in Godot 4.0, so it appears in no live Godot 4 scene; the one vendored demo that still authored it (`scenes/demos/3d/decals/decal.tscn`, itself a Godot 4.6 project that pre-dated the rename) is corrected in the corpus — both tracks retargeted to `size` with the keyframe values doubled (`size = 2 × extents`) — rather than carrying a permanent version-compat alias in our resolver. The local corpus patch is documented in `scenes/demos/README.md` so a re-vendor reapplies it.

## Considered options

- **Bind `modulate`/`size` on the target's THREE object for the mixer to drive.** Rejected for the same reason ADR-0016 rejected it for `frame`: R3F does not repaint on non-React property mutation, and `size`→geometry / `modulate`→material colour are React-derived.
- **Reuse THREE's `KeyframeTrack` interpolation by building an off-screen clip just to read interpolated values.** Rejected: standing up a mixer/clip purely as an interpolation calculator is heavier and less direct than lerping the two bracketing keys ourselves.
- **A discriminated-union payload (`{kind, value}`) instead of a bare `number[]`.** Rejected for v1: each consumer registers under a specific `(path, property)` and already knows the arity it expects; the tag adds verbosity at every push/consume site for no decoding benefit.

## Consequences

- **Cubic interpolation (`interp = 2`) and keyframe `transition` easing are approximated as linear** in v1; a note in the sampler records the limitation. `method` tracks (e.g. the demo's `queue_free` at t=5), `bezier`/`audio`/`animation` track types, and deep NodePaths remain deferred (ADR-0011).
- Per-frame pushes stay cheap exactly as in ADR-0016: the registry is ref-backed so a push never re-renders consumers — only the target component's own setter re-renders, and only while that target is actively animating.
- Colour is interpolated in Godot's stored sRGB space; the consumer applies its own semantics to the result (the Decal computes `opacity = albedo_mix × a` and converts RGB via `godotColorToLinear`), identical to its static path.
- Playback remains non-deterministic over time, so animated-decal fixtures stay out of the visual-regression manifest; the stopped/authored pose stays byte-stable.
