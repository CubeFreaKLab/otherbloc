"""Generate optional Latin WOFF2 subsets without replacing the supplied fonts.

Requires fonttools[woff] (verified with 4.59.1). Normal npm install/build does
not require Python; the generated assets are committed. --verify is read-only.
"""
import argparse
import hashlib
import json
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

RANGES = ((0x0000, 0x00FF), (0x0131, 0x0131), (0x0152, 0x0153), (0x02BB, 0x02BC),
          (0x0300, 0x036F), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2113, 0x2113),
          (0x2122, 0x2122), (0x2191, 0x2191), (0x2193, 0x2193), (0x2212, 0x2212),
          (0x2215, 0x2215), (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD))
UNICODES = {code for start, end in RANGES for code in range(start, end + 1)}
ROOT = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'fonts'
NAMES = ('georgia-regular', 'georgia-bold', 'georgia-italic', 'georgia-bold-italic')


def verify(source, output):
    original = TTFont(source)
    smaller = TTFont(output)
    original_map, smaller_map = original.getBestCmap(), smaller.getBestCmap()
    expected = set(original_map) & UNICODES
    assert set(smaller_map) == expected, 'The subset character coverage changed'
    assert original['head'].unitsPerEm == smaller['head'].unitsPerEm
    for field in ('ascent', 'descent', 'lineGap'):
        assert getattr(original['hhea'], field) == getattr(smaller['hhea'], field)
    for field in ('sTypoAscender', 'sTypoDescender', 'sTypoLineGap', 'usWinAscent', 'usWinDescent'):
        assert getattr(original['OS/2'], field) == getattr(smaller['OS/2'], field)
    original_glyphs, smaller_glyphs = original.getGlyphSet(), smaller.getGlyphSet()
    for code in expected:
        left, right = original_map[code], smaller_map[code]
        assert original['hmtx'][left] == smaller['hmtx'][right], 'Glyph spacing changed'
        a, b = DecomposingRecordingPen(original_glyphs), DecomposingRecordingPen(smaller_glyphs)
        original_glyphs[left].draw(a)
        smaller_glyphs[right].draw(b)
        assert a.value == b.value, 'Glyph outlines changed'
    return len(expected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    report = []
    for name in NAMES:
        source = ROOT / (name + '.ttf')
        full = ROOT / (name + '.woff2')
        output = ROOT / (name + '-latin.woff2')
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        font = TTFont(source, recalcTimestamp=False)
        if font['OS/2'].fsType & 0x0102:
            raise ValueError('The source font restricts embedding or subsetting: ' + name)
        if not args.verify:
            options = subset.Options()
            options.name_IDs = ['*']
            options.layout_features = ['*']
            options.glyph_names = True
            options.notdef_outline = True
            options.recalc_timestamp = False
            options.no_subset_tables += ['meta']
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=UNICODES)
            subsetter.subset(font)
            font.flavor = 'woff2'
            font.save(output)
        count = verify(source, output)
        assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
        report.append({'font': name, 'characters': count, 'fullBytes': full.stat().st_size,
                       'latinBytes': output.stat().st_size, 'outlinesAndSpacingUnchanged': True})
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
