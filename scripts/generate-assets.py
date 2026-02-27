"""Generate OG image and favicon for Am I Cooked?"""
import struct
import zlib
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(SCRIPT_DIR, '..', 'public')

def create_png(width, height, pixels):
    """Create a PNG file from raw RGBA pixel data."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter none
        for x in range(width):
            idx = (y * width + x) * 4
            raw += bytes(pixels[idx:idx+4])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend


def fill_rect(pixels, w, h, x1, y1, x2, y2, r, g, b, a=255):
    for y in range(max(0,y1), min(h,y2)):
        for x in range(max(0,x1), min(w,x2)):
            idx = (y * w + x) * 4
            pixels[idx] = r
            pixels[idx+1] = g
            pixels[idx+2] = b
            pixels[idx+3] = a


def fill_circle(pixels, w, h, cx, cy, radius, r, g, b, a=255):
    for y in range(max(0, cy-radius), min(h, cy+radius+1)):
        for x in range(max(0, cx-radius), min(w, cx+radius+1)):
            if (x-cx)**2 + (y-cy)**2 <= radius**2:
                idx = (y * w + x) * 4
                pixels[idx] = r
                pixels[idx+1] = g
                pixels[idx+2] = b
                pixels[idx+3] = a


def draw_rounded_rect(pixels, w, h, x1, y1, x2, y2, radius, r, g, b, a=255):
    # Fill main body
    fill_rect(pixels, w, h, x1+radius, y1, x2-radius, y2, r, g, b, a)
    fill_rect(pixels, w, h, x1, y1+radius, x2, y2-radius, r, g, b, a)
    # Corners
    fill_circle(pixels, w, h, x1+radius, y1+radius, radius, r, g, b, a)
    fill_circle(pixels, w, h, x2-radius, y1+radius, radius, r, g, b, a)
    fill_circle(pixels, w, h, x1+radius, y2-radius, radius, r, g, b, a)
    fill_circle(pixels, w, h, x2-radius, y2-radius, radius, r, g, b, a)


# Simple bitmap font for large text (each char is a grid pattern)
# Using 5x7 pixel grid scaled up
FONT = {
    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'M': ['10001','11011','10101','10001','10001','10001','10001'],
    'I': ['11111','00100','00100','00100','00100','00100','11111'],
    'C': ['01110','10001','10000','10000','10000','10001','01110'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'K': ['10001','10010','10100','11000','10100','10010','10001'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'D': ['11100','10010','10001','10001','10001','10010','11100'],
    '?': ['01110','10001','00001','00010','00100','00000','00100'],
    ' ': ['00000','00000','00000','00000','00000','00000','00000'],
    'F': ['11111','10000','10000','11110','10000','10000','10000'],
    'N': ['10001','11001','10101','10011','10001','10001','10001'],
    'U': ['10001','10001','10001','10001','10001','10001','01110'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    'R': ['11110','10001','10001','11110','10100','10010','10001'],
    'Y': ['10001','10001','01010','00100','00100','00100','00100'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    'S': ['01110','10001','10000','01110','00001','10001','01110'],
    'G': ['01110','10001','10000','10111','10001','10001','01110'],
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'J': ['00111','00010','00010','00010','00010','10010','01100'],
    'L': ['10000','10000','10000','10000','10000','10000','11111'],
    'P': ['11110','10001','10001','11110','10000','10000','10000'],
    'V': ['10001','10001','10001','10001','10001','01010','00100'],
    'W': ['10001','10001','10001','10101','10101','11011','10001'],
    'X': ['10001','10001','01010','00100','01010','10001','10001'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],
    '.': ['00000','00000','00000','00000','00000','00000','00100'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
    '0': ['01110','10001','10011','10101','11001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','11111'],
}


def draw_text(pixels, w, h, text, start_x, start_y, scale, r, g, b, a=255):
    cx = start_x
    for char in text.upper():
        glyph = FONT.get(char)
        if glyph is None:
            cx += 3 * scale
            continue
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == '1':
                    px = cx + gx * scale
                    py = start_y + gy * scale
                    fill_rect(pixels, w, h, px, py, px+scale, py+scale, r, g, b, a)
        cx += 6 * scale


def text_width(text, scale):
    return len(text) * 6 * scale - scale


def generate_og_image():
    """1200x630 OG image with dark theme."""
    W, H = 1200, 630
    pixels = bytearray(W * H * 4)

    # Background: dark (#0a0a0a)
    fill_rect(pixels, W, H, 0, 0, W, H, 10, 10, 10)

    # Subtle border glow at top
    for y in range(4):
        alpha = 200 - y * 50
        fill_rect(pixels, W, H, 0, y, W, y+1, 239, 68, 68, alpha)

    # Emoji area - orange circle as pan
    cx, cy = 600, 180
    fill_circle(pixels, W, H, cx, cy, 55, 245, 158, 11)  # amber/orange
    fill_circle(pixels, W, H, cx, cy, 42, 250, 204, 21)   # lighter center
    # Pan handle
    fill_rect(pixels, W, H, cx+45, cy-6, cx+95, cy+6, 160, 160, 160)
    fill_rect(pixels, W, H, cx+90, cy-8, cx+100, cy+8, 140, 140, 140)

    # Title: "AM I COOKED?"
    title = "AM I COOKED?"
    title_scale = 12
    tw = text_width(title, title_scale)
    tx = (W - tw) // 2
    draw_text(pixels, W, H, title, tx, 270, title_scale, 255, 255, 255)

    # Subtitle
    sub = "FIND OUT IF AI IS COMING FOR YOUR JOB"
    sub_scale = 4
    sw = text_width(sub, sub_scale)
    sx = (W - sw) // 2
    draw_text(pixels, W, H, sub, sx, 390, sub_scale, 156, 163, 175)

    # Bottom bar with gradient feel
    draw_rounded_rect(pixels, W, H, 350, 470, 850, 520, 8, 255, 255, 255)
    # Text in button
    btn = "CHECK YOUR SCORE"
    btn_scale = 4
    bw = text_width(btn, btn_scale)
    bx = (W - bw) // 2
    draw_text(pixels, W, H, btn, bx, 480, btn_scale, 10, 10, 10)

    # URL at bottom
    url = "AMICOOKED.IO"
    url_scale = 3
    uw = text_width(url, url_scale)
    ux = (W - uw) // 2
    draw_text(pixels, W, H, url, ux, 560, url_scale, 100, 100, 100)

    png_data = create_png(W, H, pixels)
    path = os.path.join(PUBLIC_DIR, 'og-image.png')
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f'Generated {path} ({len(png_data):,} bytes)')


def generate_favicon():
    """32x32 favicon with cooking pan icon."""
    W = H = 32
    pixels = bytearray(W * H * 4)

    # Transparent background
    fill_rect(pixels, W, H, 0, 0, W, H, 0, 0, 0, 0)

    # Pan body - orange circle
    fill_circle(pixels, W, H, 14, 16, 12, 245, 158, 11)
    fill_circle(pixels, W, H, 14, 16, 9, 250, 204, 21)

    # Pan handle
    fill_rect(pixels, W, H, 25, 14, 32, 18, 180, 180, 180)
    fill_rect(pixels, W, H, 24, 13, 26, 19, 160, 160, 160)

    # Steam lines
    for dy in [2, 6, 10]:
        fill_rect(pixels, W, H, 11, dy, 13, dy+2, 200, 200, 200, 180)
        fill_rect(pixels, W, H, 16, dy+1, 18, dy+3, 200, 200, 200, 140)

    png_data = create_png(W, H, pixels)
    path = os.path.join(PUBLIC_DIR, 'favicon.png')
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f'Generated {path} ({len(png_data):,} bytes)')


def generate_favicon_svg():
    """SVG favicon for crisp rendering."""
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="40" cy="55" r="35" fill="#F59E0B"/>
  <circle cx="40" cy="55" r="27" fill="#FACC15"/>
  <rect x="72" y="49" width="25" height="12" rx="3" fill="#A0A0A0"/>
  <rect x="70" y="47" width="6" height="16" rx="2" fill="#888"/>
  <path d="M30 25 Q32 15 34 25" stroke="#ccc" stroke-width="3" fill="none" opacity="0.6"/>
  <path d="M42 22 Q44 12 46 22" stroke="#ccc" stroke-width="3" fill="none" opacity="0.5"/>
  <path d="M52 25 Q54 15 56 25" stroke="#ccc" stroke-width="3" fill="none" opacity="0.4"/>
</svg>'''
    path = os.path.join(PUBLIC_DIR, 'favicon.svg')
    with open(path, 'w') as f:
        f.write(svg)
    print(f'Generated {path}')


def generate_apple_touch_icon():
    """180x180 Apple touch icon."""
    W = H = 180
    pixels = bytearray(W * H * 4)

    # Dark background with rounded feel
    fill_rect(pixels, W, H, 0, 0, W, H, 15, 15, 15)

    # Pan body
    cx, cy = 80, 100
    fill_circle(pixels, W, H, cx, cy, 55, 245, 158, 11)
    fill_circle(pixels, W, H, cx, cy, 42, 250, 204, 21)

    # Handle
    fill_rect(pixels, W, H, 132, 94, 172, 106, 180, 180, 180)
    fill_rect(pixels, W, H, 130, 92, 134, 108, 160, 160, 160)

    # Steam
    for i, (sx, sy) in enumerate([(65, 30), (80, 25), (95, 32)]):
        alpha = 180 - i * 30
        fill_circle(pixels, W, H, sx, sy, 4, 200, 200, 200, alpha)
        fill_circle(pixels, W, H, sx-2, sy-10, 3, 200, 200, 200, alpha-40)

    png_data = create_png(W, H, pixels)
    path = os.path.join(PUBLIC_DIR, 'apple-touch-icon.png')
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f'Generated {path} ({len(png_data):,} bytes)')


if __name__ == '__main__':
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    generate_og_image()
    generate_favicon()
    generate_favicon_svg()
    generate_apple_touch_icon()
    print('\nAll assets generated!')
