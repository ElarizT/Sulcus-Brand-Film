# Builds public/fonts/SulcusFilmSymbols.woff2: the handful of symbol glyphs the
# Sulcus Cloud UI takes from the system's fallback fonts (sidebar icons, the
# "+ New run" button, row arrows). Bundling them keeps a render identical on any
# machine instead of depending on whatever fallback fonts happen to be installed.
#
# Source: DejaVu Sans Mono (Bitstream Vera licence, which allows modified copies
# under a new name). U+FF0B FULLWIDTH PLUS SIGN is not in DejaVu; it is mapped
# to DejaVu's own plus sign.
#
#   pip install fonttools brotli
#   python3 scripts/symbols-font.py /usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf

import sys

from fontTools import subset
from fontTools.ttLib import TTFont

SRC = sys.argv[1]
OUT = "public/fonts/SulcusFilmSymbols.woff2"
CODEPOINTS = [0x21B3, 0x25C7, 0x2318, 0x2301, 0x2311, 0x2715, 0x25CB, 0x25A0,
              0x25B3, 0x24D8, 0x203A, 0x2039, 0x2212, 0x00D7, 0x002B]

font = TTFont(SRC)
for table in font["cmap"].tables:
    if table.isUnicode() and 0x2B in table.cmap:
        table.cmap[0xFF0B] = table.cmap[0x2B]

options = subset.Options()
options.flavor = "woff2"
options.name_IDs = []
options.notdef_outline = True
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=CODEPOINTS + [0xFF0B])
subsetter.subset(font)

name = font["name"]
name.names = []
for nid, value in [(1, "Sulcus Film Symbols"), (2, "Regular"), (4, "Sulcus Film Symbols"),
                   (6, "SulcusFilmSymbols-Regular"),
                   (0, "Derived from DejaVu Sans Mono. Bitstream Vera Fonts Copyright (c) 2003 Bitstream, Inc.")]:
    name.setName(value, nid, 3, 1, 0x409)
font.flavor = "woff2"
font.save(OUT)
print("wrote", OUT)
