"""Regenerate the logo files and PNG icons from the artwork below, using the Edge browser already on Windows.

Run from the site folder:  python scripts/make_assets.py
Writes to public/: logo.svg, favicon.svg, favicon-32.png, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png,
maskable-512.png, og-image.png
"""
import math
import pathlib
import struct
import subprocess
import tempfile

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PUBLIC = pathlib.Path(__file__).resolve().parent.parent / "public"

# ---- the artwork: a "1" and a "0" that is a rising sun with long, pointed rays --------------------------------------
CX, CY, RX, RY, STROKE = 82, 80, 21, 28, 11          # the zero (centre, radii, ring thickness)
RAYS = [(-42, 21), (-21, 27), (0, 31), (21, 27), (42, 21)]   # (angle from straight up in degrees, length)
RAY_BASE, GAP = 7.5, 5                                   # width of a ray at its base, gap between ring and ray


def ring_radius(deg):
    """Distance from the zero's centre to the outer edge of its ring, in a given direction."""
    s, c = math.sin(math.radians(deg)), math.cos(math.radians(deg))
    return 1 / math.sqrt((s / (RX + STROKE / 2)) ** 2 + (c / (RY + STROKE / 2)) ** 2)


def ray_polygons():
    polys = []
    for deg, length in RAYS:
        a = math.radians(deg)
        ux, uy = math.sin(a), -math.cos(a)                 # unit vector pointing out from the centre
        px, py = -uy, ux                                    # perpendicular
        r0 = ring_radius(deg) + GAP
        base = [(CX + ux * r0 + s * px * RAY_BASE / 2, CY + uy * r0 + s * py * RAY_BASE / 2) for s in (-1, 1)]
        tip = (CX + ux * (r0 + length), CY + uy * (r0 + length))
        polys.append([base[0], tip, base[1]])
    return polys


ONE = [(25, 60), (45, 46), (45, 113.5), (34, 113.5), (34, 63), (25, 69)]  # the 1, same top and bottom edges as the 0
ART = ('<path d="M' + ' L'.join(f"{x} {y}" for x, y in ONE) + ' Z" fill="#ffffff"/>'
       f'<ellipse cx="{CX}" cy="{CY}" rx="{RX}" ry="{RY}" fill="none" stroke="#ffffff" stroke-width="{STROKE}"/>'
       '<g fill="#ffd166" stroke="#ffd166" stroke-width="1" stroke-linejoin="miter">'
       + ''.join('<polygon points="' + ' '.join(f"{x:.1f},{y:.1f}" for x, y in poly) + '"/>' for poly in ray_polygons()) + '</g>')
DEFS = '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fa36a"/><stop offset="1" stop-color="#1b6e45"/></linearGradient></defs>'


def svg(rx=30, scale=1.0, label=True):
    aria = ' role="img" aria-label="Ten Good News"' if label else ""
    inner = ART if scale == 1.0 else f'<g transform="translate(64 64) scale({scale}) translate(-64 -64)">{ART}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"{aria}>{DEFS}<rect width="128" height="128" rx="{rx}" fill="url(#bg)"/>{inner}</svg>'


def shot(html: str, out: pathlib.Path, w: int, h: int):
    with tempfile.TemporaryDirectory() as tmp:
        page = pathlib.Path(tmp) / "p.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        f"--window-size={w},{h}", f"--screenshot={out}", page.as_uri()], capture_output=True, timeout=120)
    assert out.exists() and out.stat().st_size > 500, f"failed to render {out.name}"


def icon(name: str, size: int, scale: float):
    html = f'<!doctype html><body style="margin:0;background:#1f7a4d">{svg(rx=0, scale=scale, label=False).replace("<svg ", f"<svg width=\'{size}\' height=\'{size}\' ", 1)}</body>'
    shot(html, PUBLIC / name, size, size)


PUBLIC.mkdir(exist_ok=True)
(PUBLIC / "logo.svg").write_text(svg(), encoding="utf-8")
(PUBLIC / "favicon.svg").write_text(svg(label=False), encoding="utf-8")
icon("apple-touch-icon.png", 180, 0.9)
icon("icon-192.png", 192, 0.9)
icon("icon-512.png", 512, 0.9)
icon("maskable-512.png", 512, 0.74)
icon("favicon-32.png", 32, 1.0)

# favicon.ico: a single 32x32 PNG inside an ICO container (supported by every current browser)
png = (PUBLIC / "favicon-32.png").read_bytes()
(PUBLIC / "favicon.ico").write_bytes(struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png), 22) + png)

og = f"""<!doctype html><meta charset="utf-8"><body style="margin:0;width:1200px;height:630px;overflow:hidden;
background:linear-gradient(135deg,#1b6e45 0%,#2fa36a 100%);font-family:'Segoe UI',system-ui,sans-serif;color:#fff;display:flex;align-items:center;padding:0 90px;box-sizing:border-box;gap:70px">
<div style="width:300px;height:300px;flex:none;filter:drop-shadow(0 12px 30px rgba(0,0,0,.25))">{svg(label=False).replace('<svg ', "<svg width='300' height='300' ", 1)}</div>
<div><div style="font-size:92px;font-weight:800;letter-spacing:-2px;line-height:1">Ten Good News</div>
<div style="font-size:38px;margin-top:26px;line-height:1.3;max-width:640px;opacity:.95">Start your day with good news from around the world.</div>
<div style="font-size:26px;margin-top:38px;opacity:.8">tengoodnews.com &nbsp;·&nbsp; ten stories a day &nbsp;·&nbsp; no tracking</div></div></body>"""
shot(og, PUBLIC / "og-image.png", 1200, 630)
print("wrote:", ", ".join(sorted(p.name for p in PUBLIC.iterdir() if p.suffix in (".png", ".svg", ".ico"))))
