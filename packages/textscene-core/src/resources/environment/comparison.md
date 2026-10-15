---
type: Environment
category: Resources
renders_as: THREE scene.environment / background / tone mapping / fog
---

# Environment

The resource a `WorldEnvironment` holds: background and sky, ambient light, tone mapping, glow, colour adjustments, depth fog and volumetric fog. The editor injects a preview Environment on a scene that declares none (ADR-0025). Each section drives one feature from its own fixture.

## Background sky
<!-- compare: image=unit-sky-procedural status=done fixture=unit-sky-procedural.tscn -->

A `ProceduralSkyMaterial` under `background_mode = BG_SKY`. The gradient, and the sphere and floor it lights, match Godot. `sky_rotation` turns the drawn sky, the light it gives and the sky colour the fog reads, as Godot turns them.

## Tone mapping
<!-- compare: image=unit-tonemap-agx-shadow status=done fixture=unit-tonemap-agx-shadow.tscn -->

`tonemap_mode = AGX`. The lit grass and the crushed shadow match Godot.

## Ambient light + sky reflection
<!-- compare: image=unit-stage-ambient-ibl status=limitation fixture=unit-stage-ambient-ibl.tscn -->

`AMBIENT_SOURCE_COLOR` with `ambient_light_sky_contribution = 0`. The grass is lit by the flat ambient alone, while the metallic sphere still reflects the gold sky at full strength.

- **Approximated** The `SHADOWS_ONLY` box's shadow projects a visibly different shape than Godot's.

## Glow (bloom)
<!-- compare: image=unit-material-emissive status=done fixture=unit-material-emissive.tscn -->

The preview environment enables glow, which blooms the emissive sphere. Both engines draw the same tight halo and leave the ground untouched. The bright pass, the seven-level pyramid and all five blend modes are ported from Godot's shaders. The glow runs whenever the environment enables it, so a lit specular highlight blooms as well, as in Godot. A `glow_map` scales the glow per screen position, as Godot's tonemap pass does.

- **Approximated** The pyramid blurs with a 13-tap downsample and a 9-tap tent upsample rather than Godot's gaussian, so a bare glow buffer (REPLACE) differs slightly.

## Adjustments
<!-- compare: image=unit-environment-adjustments status=done fixture=unit-environment-adjustments.tscn -->

`adjustment_enabled` with brightness 1.3, contrast 1.25 and saturation 0.5 over an unshaded box and a colour background. The whole frame, background included, is brighter, harder and greyer, as in Godot. The adjustments act after the tone curve and the glow under every tone mapper.

## Depth fog
<!-- compare: image=unit-depth-fog status=done fixture=unit-depth-fog.tscn -->

`fog_enabled` in exponential mode over a colour background. The fog thickens with distance over the three boxes and hides the background, as in Godot. Godot's depth mode and its curve, the height fog, `fog_sun_scatter` and `fog_aerial_perspective` follow Godot's shader too. `fog_sky_affect` sets how far the fog covers the background.

## Volumetric fog
<!-- compare: image=unit-world-environment-basic status=limitation fixture=unit-world-environment-basic.tscn -->

`volumetric_fog_enabled` over a colour background, lit by one OmniLight3D. The fog thickens with distance over the three boxes and the background, and brightens around the light, as in Godot. A moving camera blends each frame into the last, as Godot's temporal reprojection does. A still camera shows the mean of Godot's 16 jitters, which Godot converges to. Under either fog, Godot converts a colour background to linear twice, so the background is darker than with no fog, and the previewer matches it.

- **Not drawn** `volumetric_fog_gi_inject` adds no light, because the previewer draws no VoxelGI or SDFGI.

## Volumetric fog shadow
<!-- compare: image=unit-volumetric-fog-shadow status=done fixture=unit-volumetric-fog-shadow.tscn -->

A thin box under a DirectionalLight3D tilted 60° with `shadow_enabled`, in volumetric fog of density 0.1 over a colour background. The fog under the box stays dark where the box blocks the light, and the shadow's edge in the fog matches Godot. An OmniLight3D or a SpotLight3D that casts shadows darkens the fog behind its casters in the same way. A SpotLight3D's `shadow_bias` pushes each fog cell away from the light, as in Godot, so a large bias darkens its whole cone.

## Linting

<!-- lint:begin Environment -->
Strict parsing format-checks these `Environment` properties, plus 2 inherited from Resource. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `adjustment_brightness` | float >= 0 | warning below |
| `adjustment_color_correction` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `adjustment_contrast` | float |  |
| `adjustment_enabled` | true or false |  |
| `adjustment_saturation` | float |  |
| `ambient_light_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `ambient_light_energy` | float 0-16 | warning |
| `ambient_light_sky_contribution` | float 0-1 | error |
| `ambient_light_source` | enum 0-3 (BG/DISABLED/COLOR/SKY) | warning |
| `background_camera_feed_id` | integer 1-10 | warning |
| `background_canvas_max_layer` | integer -1000-1000 | warning |
| `background_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `background_energy_multiplier` | float 0-16 | warning |
| `background_intensity` | float 0-100000 | warning |
| `background_mode` | enum 0-5 (BG_CLEAR_COLOR/BG_COLOR/BG_SKY/BG_CANVAS/BG_KEEP/BG_CAMERA_FEED) | warning |
| `fog_aerial_perspective` | float 0-1 | warning |
| `fog_density` | float >= 0 | warning below |
| `fog_depth_begin` | float |  |
| `fog_depth_curve` | float |  |
| `fog_depth_end` | float |  |
| `fog_enabled` | true or false |  |
| `fog_height` | float |  |
| `fog_height_density` | float |  |
| `fog_light_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `fog_light_energy` | float >= 0 | warning below |
| `fog_mode` | enum 0-1 (EXPONENTIAL/DEPTH) | warning |
| `fog_sky_affect` | float 0-1 | warning |
| `fog_sun_scatter` | float >= 0 | warning below |
| `glow_blend_mode` | enum 0-4 (ADDITIVE/SCREEN/SOFTLIGHT/REPLACE/MIX) | warning |
| `glow_bloom` | float 0-1 | warning |
| `glow_enabled` | true or false |  |
| `glow_hdr_luminance_cap` | float 0-256 | warning |
| `glow_hdr_scale` | float 0-4 | warning |
| `glow_hdr_threshold` | float 0-4 | warning |
| `glow_intensity` | float 0-8 | warning |
| `glow_levels/*` | float >= 0 | warning below |
| `glow_map` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `glow_map_strength` | float 0-1 | warning |
| `glow_mix` | float 0-1 | warning |
| `glow_normalized` | true or false |  |
| `glow_strength` | float 0-2 | warning |
| `reflected_light_source` | enum 0-2 (BG/DISABLED/SKY) | warning |
| `sdfgi_bounce_feedback` | float 0-1.99 | warning |
| `sdfgi_cascades` | integer 1-8 | error |
| `sdfgi_enabled` | true or false |  |
| `sdfgi_energy` | float |  |
| `sdfgi_min_cell_size` | float 0.01-64 | warning |
| `sdfgi_normal_bias` | float |  |
| `sdfgi_probe_bias` | float |  |
| `sdfgi_read_sky_light` | true or false |  |
| `sdfgi_use_occlusion` | true or false |  |
| `sdfgi_y_scale` | enum 0-2 (Y_SCALE_50_PERCENT/Y_SCALE_75_PERCENT/Y_SCALE_100_PERCENT) | warning |
| `sky` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `sky_custom_fov` | float 0-180 | warning |
| `sky_rotation` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `ssao_ao_channel_affect` | float 0-1 | warning |
| `ssao_detail` | float 0-5 | warning |
| `ssao_enabled` | true or false |  |
| `ssao_horizon` | float 0-1 | warning |
| `ssao_intensity` | float >= 0 | warning below |
| `ssao_light_affect` | float 0-1 | warning |
| `ssao_power` | float |  |
| `ssao_radius` | float >= 0.01 | warning below |
| `ssao_sharpness` | float 0-1 | warning |
| `ssil_enabled` | true or false |  |
| `ssil_intensity` | float >= 0 | warning below |
| `ssil_normal_rejection` | float 0-1 | warning |
| `ssil_radius` | float >= 0.01 | warning below |
| `ssil_sharpness` | float 0-1 | warning |
| `ssr_depth_tolerance` | float 0.01-128 | warning |
| `ssr_enabled` | true or false |  |
| `ssr_fade_in` | float >= 0 | error below |
| `ssr_fade_out` | float >= 0 | error below |
| `ssr_max_steps` | integer 32-512 | warning |
| `tonemap_agx_contrast` | float >= 1 | warning below |
| `tonemap_agx_white` | float >= 2 | warning below |
| `tonemap_exposure` | float >= 0 | warning below |
| `tonemap_mode` | enum 0-4 (LINEAR/REINHARDT/FILMIC/ACES/AGX) | warning |
| `tonemap_white` | float >= 1 | warning below |
| `volumetric_fog_albedo` | Color(r, g, b, a), or the colour string or int it converts |  |
| `volumetric_fog_ambient_inject` | float 0-16 | warning |
| `volumetric_fog_anisotropy` | float -0.9-0.9 | warning |
| `volumetric_fog_density` | float >= 0 | warning below |
| `volumetric_fog_detail_spread` | float 0.5-6 | error |
| `volumetric_fog_emission` | Color(r, g, b, a), or the colour string or int it converts |  |
| `volumetric_fog_emission_energy` | float >= 0 | warning below |
| `volumetric_fog_enabled` | true or false |  |
| `volumetric_fog_gi_inject` | float 0-16 | warning |
| `volumetric_fog_length` | float >= 0.01 | warning below |
| `volumetric_fog_sky_affect` | float 0-1 | warning |
| `volumetric_fog_temporal_reprojection_amount` | float 0.5-0.99 | warning |
| `volumetric_fog_temporal_reprojection_enabled` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects. Every scalar goes through the shared `floatOr`, `intOr`, `enumOr` and `boolOr` decoders. Each logs the bad literal and falls back to Godot's default. An unreadable `glow_intensity` therefore renders as default glow rather than as no Environment at all. A depth-mode fog with no stored `fog_density` takes 1. `fog_depth_begin` and `fog_depth_end` drag each other along, so the begin never passes the end, as Godot's setters do.

## Known limitations

- **Approximated** `tonemap_exposure` under LINEAR is ignored when no glow, blended surface or adjustment runs the tone-map pass: three applies exposure only under a tone curve.
- **Shader missing** `ssr_enabled` draws no screen-space reflections.
- **Resource gap** `adjustment_color_correction` is not applied, so a colour-correction texture leaves the frame unchanged.
