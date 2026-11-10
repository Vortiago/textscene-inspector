"""Builds recursive-contextual-rvrn.woff2 from the Recursive subset: a `GSUB` FeatureVariations record,
first in the list, swaps glyphs by their neighbours where `wght` is 650 or more. Its `rvrn` lookup turns
`a` before `b` into the single-storey `a`, and `l` after `i` into the tailed `l`. No other fixture font
has a contextual `rvrn` rule. Recursive's own records swap each glyph alone.

Usage: python3 build.py <recursive-vf-subset.woff2> <out .woff2>   (needs fonttools and brotli)
"""
import sys

from fontTools.otlLib.builder import buildLookup, buildSingleSubstSubtable
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables as ot
from fontTools.varLib.featureVars import buildConditionTable

# `wght` runs from 300 to 1000, so 650 normalises to 0.5.
WGHT_RANGE = (0.5, 1.0)
SINGLE_STOREY_A = "glyph00277"
TAILED_L = "glyph00337"

if len(sys.argv) != 3:
    sys.exit(__doc__)
source, out = sys.argv[1:3]
font = TTFont(source)
gsub = font["GSUB"].table
lookups = gsub.LookupList.Lookup


def append_lookup(lookup):
    lookups.append(lookup)
    gsub.LookupList.LookupCount = len(lookups)
    return len(lookups) - 1


def coverage(glyphs):
    table = ot.Coverage()
    table.glyphs = glyphs
    return table


def lookup_record(sequence_index, lookup_index):
    record = ot.SubstLookupRecord()
    record.SequenceIndex = sequence_index
    record.LookupListIndex = lookup_index
    return record


def chain_rule(backtrack, input_glyph, lookahead, lookup_index):
    """A format 3 chaining rule: one coverage for each glyph of the context."""
    subtable = ot.ChainContextSubst()
    subtable.Format = 3
    subtable.BacktrackCoverage = [coverage([g]) for g in backtrack]
    subtable.InputCoverage = [coverage([input_glyph])]
    subtable.LookAheadCoverage = [coverage([g]) for g in lookahead]
    subtable.SubstLookupRecord = [lookup_record(0, lookup_index)]
    return subtable


swap = append_lookup(buildLookup([buildSingleSubstSubtable({"a": SINGLE_STOREY_A, "l": TAILED_L})]))
context = append_lookup(
    buildLookup([chain_rule([], "a", ["b"], swap), chain_rule(["i"], "l", [], swap)])
)

rvrn = next(i for i, r in enumerate(gsub.FeatureList.FeatureRecord) if r.FeatureTag == "rvrn")
feature = ot.Feature()
feature.FeatureParams = None
feature.LookupListIndex = [context]
feature.LookupCount = 1
substitution = ot.FeatureTableSubstitutionRecord()
substitution.FeatureIndex = rvrn
substitution.Feature = feature
table_substitution = ot.FeatureTableSubstitution()
table_substitution.Version = 0x00010000
table_substitution.SubstitutionRecord = [substitution]
condition_set = ot.ConditionSet()
wght = next(i for i, a in enumerate(font["fvar"].axes) if a.axisTag == "wght")
condition_set.ConditionTable = [buildConditionTable(wght, *WGHT_RANGE)]
record = ot.FeatureVariationRecord()
record.ConditionSet = condition_set
record.FeatureTableSubstitution = table_substitution
records = gsub.FeatureVariations.FeatureVariationRecord
records.insert(0, record)
gsub.FeatureVariations.FeatureVariationCount = len(records)
font.save(out)
