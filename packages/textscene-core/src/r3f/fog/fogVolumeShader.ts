/**
 * The light pass's FogVolume terms: what each volume adds to a froxel's density, scattering and
 * emission, as Godot 4.6.3's volume pass rasterises it before the density stage reads the sums
 * (`renderer_rd/shaders/environment/volumetric_fog.glsl`, cited as `volume.glsl:N`).
 */

import { FOG_VOLUME_DENSITY_SCALE, FogVolumeShape } from '../../godot/rendering/environment/fogVolume.js';
import { glslFloat } from '../../utils/glslLiterals.js';
import { FogVolumeKind, FogVolumeTexel } from './fogVolumeRows.js';

/**
 * The volumes' sums at one point, in the form Godot's three maps hold them: the density in
 * 1024ths, and each colour packed 11-11-10 into a uint.
 */
export const FOG_VOLUME_GLSL = /* glsl */ `
uniform highp sampler2D fogVolumes;
uniform int fogVolumeCount;
uniform highp sampler3D fogDensityTextures;
uniform vec3 fogDensityTexturesSize;

struct FogVolumeSums {
	float densityUnits;
	uint scattering;
	uint emission;
};

vec4 volumeTexel( int volume, int texel ) {
	return texelFetch( fogVolumes, ivec2( texel, volume ), 0 );
}

// volume.glsl:203-205: an ellipsoid, a cone, a cylinder or a box. Any other shape has no surface.
float fogVolumeSdf( vec3 local, vec3 halfSize, int shape ) {
	if ( shape == ${FogVolumeShape.ELLIPSOID} ) {
		float k0 = length( local / halfSize );
		float k1 = length( local / ( halfSize * halfSize ) );
		return k0 * ( k0 - 1.0 ) / k1;
	}
	if ( shape == ${FogVolumeShape.CONE} ) {
		float inverseHeight = 1.0 / max( 0.001, halfSize.y );
		float radius = 1.0 / max( 0.001, min( halfSize.x, halfSize.z ) * 0.5 );
		vec2 c = vec2( radius, inverseHeight ) / sqrt( radius * radius + inverseHeight * inverseHeight );
		return max( dot( c, vec2( length( local.xz ), local.y - halfSize.y ) ), - halfSize.y - local.y );
	}
	if ( shape == ${FogVolumeShape.CYLINDER} ) {
		vec2 d = abs( vec2( length( local.xz ), local.y ) ) - vec2( min( halfSize.x, halfSize.z ), halfSize.y );
		return min( max( d.x, d.y ), 0.0 ) + length( max( d, 0.0 ) );
	}
	if ( shape == ${FogVolumeShape.BOX} ) {
		vec3 q = abs( local ) - halfSize;
		return length( max( q, 0.0 ) ) + min( max( q.x, max( q.y, q.z ) ), 0.0 );
	}
	return - 1.0;
}

// fog_material.cpp:159-161. Godot's pow( 0.0, 0.0 ) outside the shape adds nothing, so an edge
// fade of 0 leaves the outside empty, as a positive one does.
float fogMaterialDensity( float density, float heightAbove, float heightFalloff, float sdf, float smallestSide, float edgeFade ) {
	float falloff = clamp( exp2( - heightFalloff * heightAbove ), 0.0, 1.0 );
	float edge = clamp( - 2.0 * sdf / smallestSide, 0.0, 1.0 );
	return density * falloff * ( edge > 0.0 ? pow( edge, edgeFade ) : 0.0 );
}

// volume.glsl:233: the default fog shader, which reads no SDF, fades over a tenth of a unit inside.
float defaultFogCoverage( float sdf ) {
	return 1.0 - smoothstep( - 0.1, 0.0, sdf );
}

// One axis of a density texture's region in the atlas: the texel a 0..1 coordinate samples, held
// a half texel inside, so the region clamps to its edge as Godot binds it (fog.cpp:259-260).
float densityTexel( float coordinate, float texels ) {
	return clamp( coordinate * texels, 0.5, texels - 0.5 );
}

// fog_material.cpp:160 reads the red channel of the density texture, white where it has none.
float densityTextureAt( vec4 region, vec3 uvw ) {
	if ( region.x == 0.0 ) return 1.0;
	vec3 texel = vec3( densityTexel( uvw.x, region.x ), densityTexel( uvw.y, region.y ), densityTexel( uvw.z, region.z ) );
	return texture( fogDensityTextures, ( texel + vec3( 0.0, 0.0, region.w ) ) / fogDensityTexturesSize ).r;
}

// volume.glsl:242: a volume adds its density in fixed point, truncated towards zero.
float densityUnits( float density ) {
	return trunc( density * ${glslFloat(FOG_VOLUME_DENSITY_SCALE)} );
}

// volume.glsl:251-275: adds one volume's colour, 11-11-10 at scale, to a sum. A channel the add
// overflows saturates, and its carry stays in the channel above, as Godot's atomics leave it.
uint addPackedColor( uint sum, vec3 color, vec3 scale ) {
	uvec3 channels = uvec3( color * scale );
	uint added = sum + ( channels.r << 21 | channels.g << 10 | channels.b );
	uvec3 before = uvec3( sum >> 21, ( sum << 11 ) >> 21, sum % 1024u );
	uvec3 after = uvec3( added >> 21, ( added << 11 ) >> 21, added % 1024u );
	bvec3 overflows = lessThan( after, before + channels );
	if ( overflows.r ) added |= 2047u << 21;
	if ( overflows.g ) added |= 2047u << 10;
	if ( overflows.b ) added |= 1023u;
	return added;
}

vec3 unpackColor( uint packed, vec3 scale ) {
	return vec3( packed >> 21, ( packed << 11 ) >> 21, packed % 1024u ) / scale;
}

const vec3 SCATTERING_SCALE = vec3( 2047.0, 2047.0, 1023.0 );
const vec3 EMISSION_SCALE = vec3( 511.0, 511.0, 255.0 );

// volume.glsl:174-226 and :236-278 for each volume whose pass covers the froxel. Godot's rows run
// top-down, so the froxel's row flips before the range test. fogUnit is Godot's fog_unit_pos,
// the texture coordinate of a shape with no surface.
FogVolumeSums fogVolumesAt( vec3 view, vec3 froxel, vec3 gridSize, vec3 fogUnit ) {
	FogVolumeSums sums = FogVolumeSums( 0.0, 0u, 0u );
	vec3 cell = vec3( froxel.x, gridSize.y - 1.0 - froxel.y, froxel.z );
	for ( int i = 0; i < fogVolumeCount; i ++ ) {
		if ( any( lessThan( cell, volumeTexel( i, ${FogVolumeTexel.FROXEL_MIN} ).xyz ) ) ) continue;
		if ( any( greaterThanEqual( cell, volumeTexel( i, ${FogVolumeTexel.FROXEL_MAX} ).xyz ) ) ) continue;
		vec4 point = vec4( view, 1.0 );
		vec3 local = vec3(
			dot( volumeTexel( i, ${FogVolumeTexel.TO_LOCAL} ), point ),
			dot( volumeTexel( i, ${FogVolumeTexel.TO_LOCAL + 1} ), point ),
			dot( volumeTexel( i, ${FogVolumeTexel.TO_LOCAL + 2} ), point )
		);
		vec4 shape = volumeTexel( i, ${FogVolumeTexel.SHAPE} );
		int shapeKind = int( shape.w );
		float sdf = fogVolumeSdf( local, shape.xyz * 0.5, shapeKind );
		vec4 material = volumeTexel( i, ${FogVolumeTexel.MATERIAL} );
		bool isFogMaterial = int( material.w ) == ${FogVolumeKind.MATERIAL};
		float density;
		if ( isFogMaterial ) {
			float heightAbove = dot( volumeTexel( i, ${FogVolumeTexel.HEIGHT} ), point );
			float smallestSide = min( min( shape.x, shape.y ), shape.z );
			vec3 uvw = shapeKind <= ${FogVolumeShape.BOX} ? clamp( local / shape.xyz + 0.5, 0.0, 1.0 ) : fogUnit;
			float textured = material.x * densityTextureAt( volumeTexel( i, ${FogVolumeTexel.DENSITY_TEXTURE} ), uvw );
			density = fogMaterialDensity( textured, heightAbove, material.y, sdf, smallestSide, material.z );
		} else {
			density = shapeKind <= ${FogVolumeShape.BOX} ? defaultFogCoverage( sdf ) : 1.0;
		}
		if ( abs( density ) <= 0.001 ) continue;
		sums.densityUnits += densityUnits( density );
		float coverage = clamp( density, 0.0, 1.0 );
		if ( isFogMaterial ) {
			vec3 emission = clamp( volumeTexel( i, ${FogVolumeTexel.EMISSION} ).rgb * coverage, 0.0, 4.0 );
			sums.emission = addPackedColor( sums.emission, emission, EMISSION_SCALE );
		}
		vec3 scattering = clamp( volumeTexel( i, ${FogVolumeTexel.ALBEDO} ).rgb * coverage, 0.0, 1.0 );
		sums.scattering = addPackedColor( sums.scattering, scattering, SCATTERING_SCALE );
	}
	return sums;
}
`;
