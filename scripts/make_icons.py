#!/usr/bin/env python3
"""Generate Kalibri PNG icons (letter "K") with only the standard library.
Run from anywhere: python3 scripts/make_icons.py"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
BG = (195, 232, 90)
FG = (27, 42, 8)


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def in_k(x, y, s):
    """x, y in 0..1 icon space; s scales the glyph around the centre."""
    x = (x - 0.5) / s + 0.5
    y = (y - 0.5) / s + 0.5
    if 0.30 <= x <= 0.40 and 0.25 <= y <= 0.75:
        return True
    return (seg_dist(x, y, 0.40, 0.52, 0.67, 0.25) <= 0.05 or
            seg_dist(x, y, 0.46, 0.46, 0.69, 0.75) <= 0.05)


def in_round(x, y, r):
    cx = min(max(x, r), 1 - r)
    cy = min(max(y, r), 1 - r)
    return math.hypot(x - cx, y - cy) <= r


def png(path, size, rounded, glyph_scale, ss=2):
    rows = []
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            cov_bg = cov_fg = 0
            for sj in range(ss):
                for si in range(ss):
                    x = (i + (si + 0.5) / ss) / size
                    y = (j + (sj + 0.5) / ss) / size
                    if rounded and not in_round(x, y, 0.22):
                        continue
                    cov_bg += 1
                    if in_k(x, y, glyph_scale):
                        cov_fg += 1
            n = ss * ss
            if cov_bg == 0:
                row += bytes([0, 0, 0, 0])
                continue
            f = cov_fg / cov_bg
            col = tuple(round(BG[k] * (1 - f) + FG[k] * f) for k in range(3))
            row += bytes([*col, round(255 * cov_bg / n)])
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    with open(os.path.join(OUT, path), 'wb') as f:
        f.write(data)
    print('wrote', path)


os.makedirs(OUT, exist_ok=True)
png('icon-192.png', 192, True, 1.0)
png('icon-512.png', 512, True, 1.0)
png('icon-512-maskable.png', 512, False, 0.8)   # full-bleed, glyph inside the safe zone
png('apple-touch-icon.png', 180, False, 0.9)    # iOS rounds the corners itself

with open(os.path.join(OUT, 'favicon.svg'), 'w') as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#1f7a4d"/>'
            '<path d="M30 25v50M40 52 67 25M46 46 69 75" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none"/></svg>')
print('wrote favicon.svg')
