"""
De Bareel — Alles-in-één builder
Voer uit in C:\home\user\Luigi\:
    python maak-volledig.py
Uitvoer: debareel-alles-in-een.html (volledig standalone, geen externe bestanden nodig)
"""

import base64, mimetypes, re
from pathlib import Path

ROOT = Path(__file__).parent

def b64(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path)
    mime = mime or "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{data}"

# ── Lees bronbestanden ──
html = (ROOT / "index.html").read_text(encoding="utf-8")
css  = (ROOT / "style.css").read_text(encoding="utf-8")
js   = (ROOT / "script.js").read_text(encoding="utf-8")

# ── Vervang img src paden door base64 ──
img_dir = ROOT / "images"
def replace_img(match):
    src = match.group(1)
    # Probeer het pad te vinden, met of zonder extensie
    candidates = list(img_dir.glob(Path(src).name.split(".")[0] + ".*"))
    if not candidates:
        # Probeer ook het volledige pad
        full = ROOT / src
        candidates = [full] if full.exists() else []
    if candidates:
        img_path = candidates[0]
        print(f"  ✓ Gevonden: {img_path.name}")
        return f'src="{b64(img_path)}"'
    else:
        print(f"  ✗ Niet gevonden: {src}")
        return match.group(0)

html = re.sub(r'src="(images/[^"]+)"', replace_img, html)

# ── Vervang CSS link door inline <style> ──
html = html.replace(
    '  <link rel="stylesheet" href="style.css">',
    f'  <style>\n{css}\n  </style>'
)

# ── Vervang JS script tag door inline <script> ──
html = html.replace(
    '  <script src="script.js" defer></script>',
    f'  <script>\n{js}\n  </script>'
)

# ── Schrijf uitvoer ──
out = ROOT / "debareel-alles-in-een.html"
out.write_text(html, encoding="utf-8")

size_kb = out.stat().st_size / 1024
print(f"\n✅ Klaar! → {out.name} ({size_kb:.0f} KB)")
print("   Open dit bestand in je browser — alles zit erin, geen extra bestanden nodig.")
