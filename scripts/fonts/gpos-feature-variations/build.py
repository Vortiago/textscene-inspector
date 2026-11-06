"""Builds recursive-gpos-feature-variations.woff2 from the Recursive subset: its `kern` feature gains
a lookup that kerns A before V by EXTRA_KERNING units where `CASL` is 0.5 or more, through a `GPOS`
FeatureVariations record. No other fixture font has one. Godot's HarfBuzz reads the record at the
instance, so the font measures kerning that follows the axis in a way that the device deltas of
Recursive's `MONO` kerning do not.

Usage: python3 build.py <recursive-vf-subset.woff2> <out .woff2>   (needs fonttools and brotli)
"""
import sys

from fontTools.otlLib.builder import buildLookup, buildPairPosGlyphsSubtable, buildValue
from fontTools.ttLib import TTFont
from fontTools.varLib.featureVars import addFeatureVariationsRaw

EXTRA_KERNING = -300
CASL_RANGE = (0.5, 1.0)

source, out = sys.argv[1:3]
font = TTFont(source)
cmap = font.getBestCmap()
pairs = {(cmap[ord("A")], cmap[ord("V")]): (buildValue({"XAdvance": EXTRA_KERNING}), None)}
lookup = buildLookup([buildPairPosGlyphsSubtable(pairs, font.getReverseGlyphMap())])
gpos = font["GPOS"].table
gpos.LookupList.Lookup.append(lookup)
gpos.LookupList.LookupCount = len(gpos.LookupList.Lookup)
addFeatureVariationsRaw(
    font, gpos, [({"CASL": CASL_RANGE}, [gpos.LookupList.LookupCount - 1])], featureTag="kern"
)
font.save(out)
