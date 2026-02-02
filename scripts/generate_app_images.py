# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "playwright",
#     "opencv-python",
#     "pillow",
#     "numpy",
# ]
# ///
"""
Script for generating the individual images in the /application page's
highlighted feature scroller. Requires a locally running dev environment.
"""

from io import BytesIO
from math import floor
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
import cv2
import numpy as np
from PIL import Image, ImageDraw

URL = "http://localhost:3000"
CREDS = {"email": "testuser@mail.com", "password": "testpass"}
MOCKUPS_FOLDER = Path("generated/mockups")
ASSETS_FOLDER = Path("src/assets/images")

DIMS = {"width": 1600, "height": 900}
# removes scale bar and minimap
CLEAN_OSD_STYLE = '.openseadragon-canvas ~ div:last-of-type , div[id^="navigator-"] { display: none !important; }'


def dim_image(pil_img, factor=0.7):
    """Dim image by multiplying pixel brightness by factor (0..1)."""
    if factor >= 1.0:
        return pil_img.copy()
    arr = np.asarray(pil_img).astype(np.float32)
    arr[..., :3] = arr[..., :3] * factor
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def mask(file, rects, out=None, dim=0.7, radius=16):
    def make_rounded_mask(size, radius):
        """Create a rounded-corner mask PIL Image (L) for given size (w,h) and radius."""
        w, h = size
        mask = Image.new("L", (w, h), 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
        return mask

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

    # Load image with OpenCV (BGR) and convert to RGB for PIL use
    cv_img = cv2.imread(file, cv2.IMREAD_UNCHANGED)
    # Convert BGR -> RGB
    if len(cv_img.shape) == 3 and cv_img.shape[2] == 3:
        cv_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    elif len(cv_img.shape) == 3 and cv_img.shape[2] == 4:
        cv_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGRA2RGBA)
    else:
        # grayscale to RGB
        cv_rgb = cv2.cvtColor(cv_img, cv2.COLOR_GRAY2RGB)

    # Convert original image to PIL
    pil_orig = Image.fromarray(cv_rgb)
    # Create dimmed copy
    pil_dim = dim_image(pil_orig, factor=dim)

    # Ensure RGBA for pasting
    if pil_dim.mode != "RGBA":
        pil_dim = pil_dim.convert("RGBA")
    pil_out = pil_dim.copy()

    # Paste each selector region from original (undimmed) onto dimmed output using rounded corners
    for box in rects:
        pil_out = paste_with_mask(pil_out, pil_orig, box, radius=radius) or pil_out

    # Save result
    if out is None:
        pil_out.save(file)
    else:
        pil_out.save(out)


def wait_for_osd(page):
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)


with sync_playwright() as p:
    print("Generating screenshots...")
    browser = p.firefox.launch(headless=False)
    context = browser.new_context(viewport=DIMS)
    page = context.new_page()

    page.request.post(
        f"{URL}/api/auth/login",
        data=CREDS,
        timeout=5000,
    )

    page.goto(f"{URL}/slides")

    expect(page.get_by_role("heading", level=1)).to_contain_text(
        "Slides", timeout=10_000
    )
    page.wait_for_load_state("networkidle")
    page.screenshot(path=ASSETS_FOLDER / "applicationScroller" / "01-base.png")
    mask(
        ASSETS_FOLDER / "applicationScroller" / "01-base.png",
        [(693, 73, 786, 781)],
        ASSETS_FOLDER / "applicationScroller" / "02-triage.png",
    )

    page.goto(
        f"{URL}/slides/1/evaluate?step=wholeSlideQuality&x=0.6051&y=0.1604&z=2&roi=blast&cells-width=40"
    )
    wait_for_osd(page)
    page.get_by_role("button", name="Confirm").click()
    page.wait_for_timeout(1000)
    page.screenshot(
        path=ASSETS_FOLDER / "applicationScroller" / "03-tutorialization-rois.png"
    )
    mask(
        ASSETS_FOLDER / "applicationScroller" / "03-tutorialization-rois.png",
        [(15, 830, 1592, 892), (345, 677, 750, 853)],
    )
    page.get_by_role("button", name="Confirm").click()
    cells = page.get_by_role("list").get_by_role("button")
    cells.nth(0).click()
    wait_for_osd(page)
    page.screenshot(
        path=ASSETS_FOLDER / "applicationScroller" / "04-tutorialization-cells.png"
    )
    mask(
        ASSETS_FOLDER / "applicationScroller" / "04-tutorialization-cells.png",
        [(15, 830, 1592, 892), (705, 655, 1095, 850)],
    )

    page.goto(f"{URL}/slides/1?cells-width=40")
    wait_for_osd(page)
    page.screenshot(path=ASSETS_FOLDER / "applicationScroller" / "05-slide-viewer.png")
    mask(
        ASSETS_FOLDER / "applicationScroller" / "05-slide-viewer.png",
        [(9, 77, 451, 263)],
        ASSETS_FOLDER / "applicationScroller" / "06-scarcity-cellularity.png",
    )
    mask(
        ASSETS_FOLDER / "applicationScroller" / "05-slide-viewer.png",
        [(11, 273, 452, 823)],
        ASSETS_FOLDER / "applicationScroller" / "08-cell-differential.png",
    )

    with page.expect_popup() as popup_info:
        page.get_by_role("button", name="Open report").click()

    popup = popup_info.value
    popup.wait_for_load_state("networkidle")

    main_window_img = dim_image(Image.open(BytesIO(page.screenshot())))
    popup_window_img = Image.open(BytesIO(popup.screenshot()))
    popup_window_img = popup_window_img.crop(popup_window_img.getbbox(alpha_only=True))

    popup_position = (
        floor(main_window_img.width / 2 - popup_window_img.width / 2),
        20,
    )
    main_window_img.paste(popup_window_img, popup_position)
    main_window_img.save(ASSETS_FOLDER / "applicationScroller" / "12-report.png")

    page.get_by_role("button", name="Diff per ROI").click()
    page.wait_for_timeout(3000)
    page.screenshot(
        path=ASSETS_FOLDER / "applicationScroller" / "09-full-differential.png"
    )
    page.get_by_role("button", name="close").click()
    page.wait_for_timeout(3000)

    table = page.get_by_role("table", name="Cell differential")
    neutrophils = table.get_by_role("cell", name="Myelocyte", exact=True).locator("..")
    neutrophils.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=ASSETS_FOLDER / "applicationScroller" / "10-cell-list.png")
    mask(
        ASSETS_FOLDER / "applicationScroller" / "10-cell-list.png",
        [(11, 273, 500, 823), (454, 17, 912, 892)],
    )

    page.goto(
        f"{URL}/slides/1?table=dysplasia&x=0.3897&y=0.0841&z=369&dysplasia=blasts_immature_granulocytes-vacuolated&cell-id=550&cells-width=40"
    )
    wait_for_osd(page)
    page.screenshot(path=ASSETS_FOLDER / "applicationScroller" / "11-dysplasias.png")
    mask(
        ASSETS_FOLDER / "applicationScroller" / "11-dysplasias.png",
        [(11, 273, 500, 823), (454, 12, 912, 892)],
    )

    page.goto(f"{URL}/slides/1?x=0.4137&y=0.1636&z=2&mask=center_mask")
    wait_for_osd(page)
    page.screenshot(
        path=ASSETS_FOLDER / "applicationScroller" / "07-mask-visualization.png"
    )
    mask(
        ASSETS_FOLDER / "applicationScroller" / "07-mask-visualization.png",
        [(455, 72, 1590, 889), (455, 8, 844, 150)],
    )

    page.goto(f"{URL}/slides/1?x=0.3813&y=0.1554&z=2&mask=center_mask")
    wait_for_osd(page)
    page.screenshot(path=MOCKUPS_FOLDER / "mockup-mask.png")

    page.goto(f"{URL}/slides/1?x=0.6835&y=0.2263&z=279&cells=blast&cells-width=25")
    page.get_by_role("switch", name="Show labels").check()
    wait_for_osd(page)
    page.screenshot(path=MOCKUPS_FOLDER / "mockup-cells.png")

    page.goto(f"{URL}/slides/1?x=0.6596&y=0.2067&z=91")
    wait_for_osd(page)
    page.locator("#openSeaDragon .openseadragon-canvas").first.screenshot(
        path=ASSETS_FOLDER / "application" / "cells.png",
        # hide scalebar
        style=CLEAN_OSD_STYLE,
    )

    page.goto(f"{URL}/slides/1?x=0.5255&y=0.1758&z=7&mask=cytology_component_mask")
    wait_for_osd(page)
    page.locator("#openSeaDragon .openseadragon-canvas").first.screenshot(
        path=ASSETS_FOLDER / "application" / "app-texture-mask.png",
        # hide scalebar
        style=CLEAN_OSD_STYLE,
    )

    page.goto(f"{URL}/slides/1?x=0.6835&y=0.2263&z=279&cells=blast&cells-width=100")
    wait_for_osd(page)
    page.screenshot(path=ASSETS_FOLDER / "application" / "app-cell-list.png")
