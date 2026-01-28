#!/usr/bin/env python3
# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "opencv-python",
#     "pillow",
#     "numpy",
# ]
# ///

"""
Image selector tool for finding coordinates for cropping the application page
highlighted scroller images.

Usage:
  python image_selector.py /path/to/image.jpg

Controls (when image window is focused):
  - Left-click + drag : draw a rectangle selector (release to finalize)
  - 'u' : undo last selector
  - 'r' : reset / clear all selectors
  - 's' or Enter : finish and produce output image
  - 'q' or Esc : quit without saving

Output:
  - Saves a file next to the input image named "<original>_highlighted.png"
  - Prints selector coordinates (x1, y1, x2, y2) in pixels (top-left origin)
"""

import argparse
import os
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw


# ---------- Interactive rectangle selector using OpenCV ----------
class RectSelector:
    def __init__(self, image):
        self.image = image.copy()
        self.display = image.copy()
        self.start = None
        self.end = None
        self.drawing = False
        self.rects = []  # list of (x1,y1,x2,y2)
        self.window_name = (
            "Image Selector - draw rectangles. Press 's' or Enter when done."
        )

    def reset_display(self):
        self.display = self.image.copy()
        # draw existing rects
        for x1, y1, x2, y2 in self.rects:
            cv2.rectangle(self.display, (x1, y1), (x2, y2), (0, 255, 0), 2)

    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.start = (x, y)
            self.end = (x, y)
            self.drawing = True
        elif event == cv2.EVENT_MOUSEMOVE and self.drawing:
            self.end = (x, y)

            # redraw everything
            self.display = self.image.copy()
            for x1, y1, x2, y2 in self.rects:
                cv2.rectangle(self.display, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # draw active rectangle (live preview)
            cv2.rectangle(self.display, self.start, self.end, (0, 255, 255), 2)
            cv2.imshow(self.window_name, self.display)

        elif event == cv2.EVENT_LBUTTONUP and self.drawing:
            self.end = (x, y)
            self.drawing = False
            x1 = min(self.start[0], self.end[0])
            y1 = min(self.start[1], self.end[1])
            x2 = max(self.start[0], self.end[0])
            y2 = max(self.start[1], self.end[1])
            # Clamp to image bounds
            h, w = self.image.shape[:2]
            x1 = max(0, min(w - 1, x1))
            x2 = max(0, min(w - 1, x2))
            y1 = max(0, min(h - 1, y1))
            y2 = max(0, min(h - 1, y2))
            if x2 - x1 > 1 and y2 - y1 > 1:
                self.rects.append((x1, y1, x2, y2))
            self.reset_display()


def make_rounded_mask(size, radius):
    """Create a rounded-corner mask PIL Image (L) for given size (w,h) and radius."""
    w, h = size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    return mask


def dim_image(pil_img, factor=0.7):
    """Dim image by multiplying pixel brightness by factor (0..1)."""
    if factor >= 1.0:
        return pil_img.copy()
    arr = np.asarray(pil_img).astype(np.float32)
    arr[..., :3] = arr[..., :3] * factor
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def paste_with_mask(base_pil, src_pil, box, radius=None):
    """Paste src_pil region into base_pil at box=(x1,y1,x2,y2) with rounded mask."""
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1
    if w <= 0 or h <= 0:
        return
    if src_pil.mode not in ("RGBA", "RGB"):
        src_pil = src_pil.convert("RGBA")
    region = src_pil.crop((x1, y1, x2, y2))
    mask = make_rounded_mask((w, h), radius)
    # If base has alpha, ensure proper mode
    if base_pil.mode != "RGBA":
        base_pil = base_pil.convert("RGBA")
    region = region.convert("RGBA")
    # Apply mask as alpha channel to region
    region_masked = Image.new("RGBA", (w, h))
    region_masked.paste(region, (0, 0), mask=mask)
    base_pil.paste(region_masked, (x1, y1), mask=region_masked.split()[-1])
    return base_pil


def main():
    parser = argparse.ArgumentParser(
        description="Draw rectangle selectors on an image and create a dimmed overlay with highlighted regions."
    )
    parser.add_argument("image_path", help="Path to image file")
    parser.add_argument(
        "--dim-factor",
        type=float,
        default=0.7,
        help="Brightness factor for dimming (0..1). Default 0.7 => 30%% dim.",
    )
    parser.add_argument(
        "--radius",
        type=int,
        default=16,
        help="Rounded corner radius in pixels (defaults to ~8%% of smaller rect side).",
    )
    parser.add_argument(
        "--save",
        type=str,
        default=None,
        help="Optional output path. If omitted, saves next to input file as <name>_highlighted.png",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.image_path):
        print("Error: file not found:", args.image_path)
        sys.exit(1)

    # Load image with OpenCV (BGR) and convert to RGB for PIL use
    cv_img = cv2.imread(args.image_path, cv2.IMREAD_UNCHANGED)
    if cv_img is None:
        print("Error: could not load image:", args.image_path)
        sys.exit(1)
    # Convert BGR -> RGB
    if len(cv_img.shape) == 3 and cv_img.shape[2] == 3:
        cv_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    elif len(cv_img.shape) == 3 and cv_img.shape[2] == 4:
        cv_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGRA2RGBA)
    else:
        # grayscale to RGB
        cv_rgb = cv2.cvtColor(cv_img, cv2.COLOR_GRAY2RGB)

    # Keep a displayable BGR copy for OpenCV windows
    display_bgr = cv2.cvtColor(cv_rgb.copy(), cv2.COLOR_RGB2BGR)

    selector = RectSelector(display_bgr)
    cv2.namedWindow(selector.window_name, cv2.WINDOW_NORMAL | cv2.WINDOW_KEEPRATIO)
    cv2.setMouseCallback(selector.window_name, selector.mouse_callback)

    print("Instructions:")
    print(" - Left-click + drag to draw rectangles.")
    print(" - 'u' : undo last selector")
    print(" - 'r' : reset all selectors")
    print(" - 's' or Enter : finish and save result")
    print(" - 'q' or Esc : quit without saving")
    print("When finished, the script will print selector coordinates (x1, y1, x2, y2).")

    while True:
        selector.reset_display()
        cv2.imshow(selector.window_name, selector.display)
        key = cv2.waitKey(20) & 0xFF
        if key == 27:  # Esc
            print("Exit without saving.")
            cv2.destroyAllWindows()
            sys.exit(0)
        elif key in (ord("s"), 13):  # 's' or Enter
            break
        elif key == ord("u"):
            if selector.rects:
                selector.rects.pop()
                print("Undo last selector. Remaining:", len(selector.rects))
        elif key == ord("r"):
            selector.rects.clear()
            print("Cleared all selectors.")
        elif key == ord("q"):
            print("Exit without saving.")
            cv2.destroyAllWindows()
            sys.exit(0)
        # else continue drawing

    cv2.destroyAllWindows()

    rects = selector.rects
    if not rects:
        print("No selectors were made. Exiting.")
        sys.exit(0)

    # Convert original image to PIL
    pil_orig = Image.fromarray(cv_rgb)
    # Create dimmed copy
    pil_dim = dim_image(pil_orig, factor=args.dim_factor)

    # Ensure RGBA for pasting
    if pil_dim.mode != "RGBA":
        pil_dim = pil_dim.convert("RGBA")
    pil_out = pil_dim.copy()

    # Paste each selector region from original (undimmed) onto dimmed output using rounded corners
    for box in rects:
        pil_out = paste_with_mask(pil_out, pil_orig, box, radius=args.radius) or pil_out

    # Save result
    base, ext = os.path.splitext(os.path.basename(args.image_path))
    if args.save:
        out_path = args.save
    else:
        out_path = os.path.join(
            os.path.dirname(args.image_path), f"{base}_highlighted.png"
        )
    pil_out.save(out_path)
    print("Saved output image to:", out_path)

    # Print coordinates
    print("Selector coordinates (x1, y1, x2, y2):")
    print(", ".join(str(r) for r in rects))


if __name__ == "__main__":
    main()
