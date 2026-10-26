# Pure-python PNG icon generator -- no dependencies, original geometric design.
# Run: python scripts/gen_icons.py  (from the project root)
import struct, zlib, math, os

BG_TOP = (246, 239, 231)      # cream
BG_BOTTOM = (232, 200, 165)   # warm sand
GLYPH = (196, 85, 45)         # terracotta accent
RING = (42, 33, 24)           # ink

def png(width, height, pixels):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(row) for row in pixels)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def dist_to_segment(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

def render(size, maskable=False):
    s = float(size)
    cx = s / 2
    top_y, mid_y = (0.36 * s, 0.66 * s) if not maskable else (0.40 * s, 0.64 * s)
    spread = 0.13 * s
    half = spread if not maskable else spread * 0.8
    thick = 0.055 * s if not maskable else 0.045 * s
    dot_r = 0.045 * s if not maskable else 0.036 * s
    dot_y = (mid_y + 0.14 * s) if not maskable else (mid_y + 0.12 * s)

    rows = []
    for y in range(size):
        row = bytearray()
        t = y / max(1, size - 1)
        bg = lerp(BG_TOP, BG_BOTTOM, t)
        for x in range(size):
            # rounded-rect mask for regular icons (full-bleed for maskable)
            r = 0.22 * s
            margin = 0 if maskable else 0
            in_rect = True
            if not maskable:
                margin = 0
            # anti-aliased glyph coverage
            d1 = dist_to_segment(x, y, cx - half, top_y, cx, mid_y)
            d2 = dist_to_segment(x, y, cx, mid_y, cx + half, top_y)
            d = min(d1, d2)
            dd = dist_to_segment(x, y, cx, dot_y, cx + 0.001, dot_y)
            cover = max(0.0, min(1.0, (thick / 2 - d) * s / size * 3 + 0.5))
            cover_dot = max(0.0, min(1.0, (dot_r - dd) * 3 + 0.5))
            cov = max(cover, cover_dot)
            col = lerp(bg, GLYPH, cov)
            # thin ink ring at rounded-rect edge (non-maskable)
            if not maskable:
                # distance to rounded-rect boundary
                q = 0.5 * s - 1
                rx, ry = abs(x - q), abs(y - q)
                rr = r / 2
                ax, ay = max(rx - (q - rr), 0), max(ry - (q - rr), 0)
                d_edge = math.hypot(ax, ay) - rr
                edge = max(0.0, min(1.0, (-d_edge) * 3))
                col = lerp(col, RING, 0.18 * edge)
            row += bytes((col[0], col[1], col[2], 255))
        rows.append(row)
    return png(size, size, rows)

out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(out, exist_ok=True)
specs = {"icon-192.png": (192, False), "icon-512.png": (512, False), "maskable-512.png": (512, True), "apple-touch-icon.png": (180, False)}
for name, (size, maskable) in specs.items():
    with open(os.path.join(out, name), "wb") as f:
        f.write(render(size, maskable))
    print("wrote", name)
