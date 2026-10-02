# Lays review stills out on one sheet: python3 scripts/sheet.py out.jpg a.jpg b.jpg ...
import sys
from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
W, H = 960, 540
cols = 2
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (W * cols, (H + 24) * rows), "#222")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS)
    x, y = (i % cols) * W, (i // cols) * (H + 24)
    sheet.paste(im, (x, y + 24))
    frame = int(f.split("f")[-1].split(".")[0])
    d.text((x + 8, y + 5), f"{frame / 24:.2f}s  (frame {frame})", fill="#fff")
sheet.save(out, quality=88)
