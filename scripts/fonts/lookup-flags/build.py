"""Builds montserrat-lookup-flags.ttf from the Montserrat mark subset: a `GSUB` whose `liga` lookups
skip the marks between the glyphs they read, and a multiple substitution. `f` `i` ligates into `B`
across a mark, `a` before `n` turns into `e` across a mark, and `x` turns into `o` `x`. The subset's
own `GSUB` holds no feature, and its `GPOS` places the marks.

Usage: python3 build.py <montserrat-semibold-marks-subset.ttf> <out .ttf>   (needs fonttools)
"""
import sys

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.ttLib import TTFont

FEATURES = """
languagesystem DFLT dflt;
languagesystem latn dflt;

lookup SWAP_A {
  sub a by e;
} SWAP_A;

lookup LIGATURE_ACROSS_MARKS {
  lookupflag IgnoreMarks;
  sub f i by B;
} LIGATURE_ACROSS_MARKS;

lookup CONTEXT_ACROSS_MARKS {
  lookupflag IgnoreMarks;
  sub a' lookup SWAP_A n;
} CONTEXT_ACROSS_MARKS;

lookup MULTIPLE {
  sub x by o x;
} MULTIPLE;

feature liga {
  lookup LIGATURE_ACROSS_MARKS;
  lookup CONTEXT_ACROSS_MARKS;
  lookup MULTIPLE;
} liga;
"""

if len(sys.argv) != 3:
    sys.exit(__doc__)
source, out = sys.argv[1:3]
font = TTFont(source)
del font["GSUB"]
addOpenTypeFeaturesFromString(font, FEATURES, tables=["GSUB"])
font.save(out)
