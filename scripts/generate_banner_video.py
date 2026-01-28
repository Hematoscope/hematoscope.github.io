# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "playwright",
# ]
# ///
"""
Script for generating the banner video for the front page of this site.
Requires a local dev environment running at `URL`.
"""

import os
import subprocess

from playwright.sync_api import Locator, Page, expect, sync_playwright

URL = "http://localhost:3000"


def get_element_mouse_interactions(
    page: Page,
    element: Locator,
    timeout: int = 300,
    origin: tuple[int, int] | None = None,
):
    """
    Returns helper functions for mouse interactions over some element.

    This is mostly useful for testing interactions with OpenSeaDragon: the
    helpers include a small waiting period, as Playwright won't automagically
    wait for the OSD renderer to finish its smoothing animations.
    """
    bbox = element.bounding_box()
    # canvas center
    cc_x = (bbox["x"] + (origin[0] if origin else bbox["width"] // 2)) if bbox else 0
    cc_y = (bbox["y"] + (origin[1] if origin else bbox["height"] // 2)) if bbox else 0

    def scroll(delta: int, override_timeout=None):
        """
        Emulate a mouse scrolling over element.
        Negative delta scrolls up (zooms in), positive down (zooms out)

        As OSD seems to move the viewport only once per scroll event and this
        function dispatches only a single event, it probably doesn't matter what
        value the `delta` is, perhaps only its sign has significance
        """
        page.mouse.move(cc_x, cc_y)
        page.mouse.wheel(0, delta)
        page.wait_for_timeout(override_timeout or timeout)

    def drag(delta_x: int, delta_y: int):
        """
        Emulate a mouse drag over element starting from center pixel,
        resetting mouse to center afterwards
        """
        page.mouse.down()
        page.mouse.move(cc_x + delta_x, cc_y + delta_y, steps=1)
        page.mouse.up()
        page.mouse.move(cc_x, cc_y)
        page.wait_for_timeout(timeout)

    return scroll, drag


DIMS = {"width": 1600, "height": 1000}

with sync_playwright() as p:
    print("Generating video...")
    # browser = p.chromium.launch()
    browser = p.firefox.launch(headless=False)
    context = browser.new_context(
        viewport=DIMS,
        record_video_dir="public",
        record_video_size=DIMS,
    )
    page = context.new_page()
    page.set_viewport_size(DIMS)

    page.request.post(
        f"{URL}/api/auth/login",
        data={"email": "testuser@mail.com", "password": "testpass"},
        timeout=5000,
    )

    try:
        page.goto(f"{URL}/slides/1?cells-width=25")

        expect(page.get_by_role("heading", level=1)).to_contain_text(
            "5320", timeout=10_000
        )

        page.get_by_role("switch", name="Show labels").check()
        osd_element = page.locator("#openSeaDragon")
        expect(osd_element).to_be_visible()
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)
        page.wait_for_timeout(3000)

        scroll, drag = get_element_mouse_interactions(page, osd_element)

        # interact with the osd sample viewer
        for _ in range(5):
            scroll(-100, override_timeout=50)
        page.wait_for_timeout(500)
        drag(300, 100)
        drag(300, 100)
        page.wait_for_timeout(500)
        for _ in range(6):
            scroll(-100, override_timeout=50)
        page.wait_for_timeout(500)
        drag(300, 100)
        page.wait_for_timeout(1500)
        drag(200, 400)
        for _ in range(2):
            scroll(-100, override_timeout=50)
        page.wait_for_timeout(1500)
        drag(300, 100)
        page.wait_for_timeout(1500)
        drag(100, -400)
        page.wait_for_timeout(1500)

        # Show cell list viewing
        table = page.get_by_role("table", name="Cell differential")
        neutrophils = table.get_by_role("cell", name="Neutrophil").locator("..")
        neutrophils.click()
        page.wait_for_timeout(3000)
        page.get_by_role("switch", name="Show labels").uncheck()

        cells = page.get_by_role("list").get_by_role("button")
        cells.nth(0).click()
        page.wait_for_selector("#openSeaDragon[data-loaded=false]", timeout=10_000)
        page.wait_for_timeout(3000)
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)
        cells.nth(1).click()
        page.wait_for_selector("#openSeaDragon[data-loaded=false]", timeout=10_000)
        page.wait_for_timeout(3000)
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)
        cells.nth(2).click()
        page.wait_for_selector("#openSeaDragon[data-loaded=false]", timeout=10_000)
        page.wait_for_timeout(3000)
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)

        blasts = table.get_by_role("cell", name="Blast", exact=True).locator("..")
        blasts.click()
        page.wait_for_timeout(4000)

        cells = page.get_by_role("list").get_by_role("button")
        cells.nth(0).click()
        page.wait_for_selector("#openSeaDragon[data-loaded=false]", timeout=10_000)
        page.wait_for_timeout(3000)
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)
        cells.nth(3).click()
        page.wait_for_selector("#openSeaDragon[data-loaded=false]", timeout=10_000)
        page.wait_for_timeout(3000)
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)

        blasts.click()
        page.wait_for_timeout(3000)
        page.get_by_role("button", name="Reset").click()
        page.wait_for_selector("#openSeaDragon[data-loaded=false]", timeout=10_000)
        page.wait_for_timeout(3000)
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)

        # viewer again
        # page.get_by_role("button", name="Reset").click()
        # page.wait_for_timeout(1500)
        # osd_element.locator("rect").all()[1].click()
        # page.wait_for_timeout(1500)
        # for _ in range(8):
        #    scroll(-10, override_timeout=10)
        # page.wait_for_timeout(1500)
        # page.get_by_role("button", name="Reset").click()
        # page.wait_for_timeout(1500)

        # masks
        page.get_by_role("button", name="Sample").click()
        page.wait_for_timeout(3000)
        page.get_by_role("button", name="Tissues").click()
        page.wait_for_timeout(1500)
        for _ in range(3):
            scroll(-10, override_timeout=10)
        page.wait_for_timeout(1500)
        page.get_by_role("button", name="Lipids").click()
        page.wait_for_timeout(3000)
        page.get_by_role("button", name="Lipids").click()
        page.get_by_role("button", name="Reset").click()
        page.wait_for_timeout(3000)

    finally:
        # cleanup
        context.close()
        browser.close()

        SKIP_SECONDS = 10  # this probably needs to be set each time manually
        CROP_W = 46
        CROP_H = 28

        if page.video:
            print("Rendering to .mp4...")

            BASE_OPTS = [
                "-y",
                "-i",
                page.video.path(),
                "-ss",
                str(SKIP_SECONDS),
            ]
            subprocess.run(
                [
                    "ffmpeg",
                    *BASE_OPTS,
                    "-c:v",
                    "libx264",
                    "-crf",
                    "23",
                    "-preset",
                    "veryfast",
                    "-vf",
                    f"crop={DIMS['width'] - CROP_W}:{DIMS['height'] - CROP_H}:0:0",
                    "public/out.mp4",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            COMMON_OPTS = [
                "-threads",
                "8",
                "-row-mt",
                "1",
                "-b:v",
                "1000k",
                "-c:v",
                "libvpx-vp9",
                "-crf",
                "45",
                "-vf",
                f"crop={DIMS['width'] - CROP_W}:{DIMS['height'] - CROP_H}:0:0",
            ]

            print("Rendering to .webm (high quality)...")
            subprocess.run(
                [
                    "ffmpeg",
                    *BASE_OPTS,
                    *COMMON_OPTS,
                    "public/banner_large.webm",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            print("Rendering to .webm (mid quality)...")
            subprocess.run(
                [
                    "ffmpeg",
                    *BASE_OPTS,
                    *COMMON_OPTS,
                    "-filter:v",
                    f"crop={DIMS['width'] - CROP_W}:{DIMS['height'] - CROP_H}:0:0, scale=iw/1.5:ih/1.5",
                    "public/banner_mid.webm",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            print("Rendering to .webm (low quality)...")
            subprocess.run(
                [
                    "ffmpeg",
                    *BASE_OPTS,
                    *COMMON_OPTS,
                    "-filter:v",
                    f"crop={DIMS['width'] - CROP_W}:{DIMS['height'] - CROP_H}:0:0, scale=iw/2:ih/2",
                    "public/banner_small.webm",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            print("Extracting banner image...")
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    "public/banner_large.webm",
                    "-vframes",
                    "1",
                    "public/banner_image.jpeg",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            try:
                os.remove("public/out.webm")
            except:  # noqa: E722
                pass
            os.rename(page.video.path(), "public/out.webm")
