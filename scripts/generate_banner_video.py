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

import base64
import os
import shutil
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


DIMS = {"width": 1600, "height": 1000}  # CSS-pixel viewport — UI renders at this logical size
DEVICE_SCALE = 1
REC_DIMS = {"width": DIMS["width"] * DEVICE_SCALE, "height": DIMS["height"] * DEVICE_SCALE}

# Headed mode is for visual debugging; the actual recording should run
# headless so the framing matches REC_DIMS exactly. In headed mode the
# tab + address bar chrome eats vertical space off the top of the content
# area — HEADED_CHROME_PADDING_PX compensates so the inner viewport still
# matches DIMS. Bump it if you see clipping at the bottom (the exact value
# is OS/Chromium-version-dependent, ~88px is typical on Linux).
HEADLESS = True
HEADED_CHROME_PADDING_PX = 88

with sync_playwright() as p:
    print("Generating video...")
    # CDP screencast is Chromium-only — Firefox would need the WebM path back.
    # `--window-size` pins Chromium's actual render surface (default 800x600);
    # otherwise the page lays out at DIMS via viewport emulation but the
    # screencast only captures the smaller real window, clipping the right
    # and bottom edges. `--hide-scrollbars` keeps stray scrollbars out.
    window_h = DIMS["height"] + (0 if HEADLESS else HEADED_CHROME_PADDING_PX)
    chromium_args = [
        f"--window-size={DIMS['width']},{window_h}",
        "--hide-scrollbars",
    ]
    browser = p.chromium.launch(headless=HEADLESS, args=chromium_args)
    os.makedirs("generated", exist_ok=True)
    context = browser.new_context(
        viewport=DIMS,
        device_scale_factor=DEVICE_SCALE,
    )
    page = context.new_page()
    page.set_viewport_size(DIMS)

    FRAMES_DIR = "generated/frames"
    shutil.rmtree(FRAMES_DIR, ignore_errors=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)
    CONCAT_LIST = os.path.join(FRAMES_DIR, "frames.txt")

    cdp = context.new_cdp_session(page)
    frame_records: list[tuple[float, str]] = []

    def _on_screencast_frame(params):
        idx = len(frame_records)
        filename = f"frame_{idx:06d}.jpg"
        with open(os.path.join(FRAMES_DIR, filename), "wb") as f:
            f.write(base64.b64decode(params["data"]))
        frame_records.append((params["metadata"]["timestamp"], filename))
        cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]})

    cdp.on("Page.screencastFrame", _on_screencast_frame)

    page.request.post(
        f"{URL}/api/auth/login",
        data={"email": "test@mail.com", "password": "testpass"},
        timeout=5000,
    )

    try:
        page.goto(f"{URL}/slides/1?cells-width=300")

        expect(page.get_by_role("heading", level=1)).to_contain_text(
            "5320", timeout=10_000
        )

        page.get_by_role("switch", name="Labels").check()
        # MUI Tooltip opens on hover *and* focus; .check() leaves both active.
        page.mouse.move(0, 0)
        page.evaluate("document.activeElement?.blur()")
        osd_element = page.locator("#openSeaDragon")
        expect(osd_element).to_be_visible()
        page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=10_000)
        # In headed mode Playwright resizes the OS window so the content area
        # matches the viewport, but chrome UI then overlaps and clips the
        # bottom of the rendered page in the screencast. Force the window back
        # to a size that leaves DIMS-worth of content area underneath the UI.
        # `--window-size` alone isn't enough because Playwright's resize runs
        # later and wins.
        if not HEADLESS:
            window_info = cdp.send("Browser.getWindowForTarget")
            cdp.send(
                "Browser.setWindowBounds",
                {
                    "windowId": window_info["windowId"],
                    "bounds": {
                        "width": DIMS["width"],
                        "height": DIMS["height"] + HEADED_CHROME_PADDING_PX,
                    },
                },
            )
            page.wait_for_timeout(500)
        cdp.send(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": 95,
                "maxWidth": REC_DIMS["width"],
                "maxHeight": REC_DIMS["height"],
                "everyNthFrame": 1,
            },
        )
        page.wait_for_timeout(3000)

        scroll, drag = get_element_mouse_interactions(page, osd_element)

        # interact with the osd sample viewer
        for _ in range(5):
            scroll(-100, override_timeout=50)
        page.wait_for_timeout(500)
        drag(300, 100)
        drag(300, 100)
        page.wait_for_timeout(500)
        for _ in range(8):
            scroll(-100, override_timeout=50)
        page.wait_for_timeout(500)
        drag(300, 100)
        page.wait_for_timeout(1500)
        drag(-200, 400)
        page.wait_for_timeout(1500)
        drag(-300, 100)
        page.wait_for_timeout(1500)
        drag(-300, -700)
        page.wait_for_timeout(1500)

        # Show cell list viewing
        table = page.get_by_role("table", name="Cell differential")
        neutrophils = table.get_by_role("cell", name="Neutrophil").locator("..")
        neutrophils.click()
        page.wait_for_timeout(3000)
        page.get_by_role("switch", name="Labels").uncheck()

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
        # Always stop the screencast — wrapped because it raises if screencast
        # was never started (e.g. an exception before the start call).
        try:
            cdp.send("Page.stopScreencast")
        except Exception:
            pass
        context.close()
        browser.close()

        # Edge trim in CSS pixels — scaled to device pixels via DEVICE_SCALE so
        # the same logical crop works whether the recording is 1x or 2x DPR.
        # CDP screencast + --hide-scrollbars has no edge artifacts, so 0/0 is
        # the right default; bump these if you ever spot stray pixels at the
        # right or bottom.
        CROP_W = 0 * DEVICE_SCALE
        CROP_H = 0 * DEVICE_SCALE
        CROPPED_W = REC_DIMS["width"] - CROP_W
        CROPPED_H = REC_DIMS["height"] - CROP_H
        CROP = f"crop={CROPPED_W}:{CROPPED_H}:0:0"

        # Three-rendition ladder derived from the cropped source. With DPR=2
        # this gives crisp output on retina devices; the lower rungs still
        # match what we used to ship for 1x displays.
        def _even(n: float) -> int:
            return int(n) - (int(n) % 2)

        def _rendition(divisor: float) -> tuple[int, int]:
            return _even(CROPPED_W / divisor), _even(CROPPED_H / divisor)

        HIGH_W, HIGH_H = _rendition(1)
        MID_W, MID_H = _rendition(2)
        LOW_W, LOW_H = _rendition(3)

        # Maxrate ceiling scaled with pixel count (~0.10 bpp at 30 fps). CRF is
        # the actual quality target — maxrate only caps the worst-case bursts.
        def _maxrate_k(w: int, h: int) -> int:
            return max(1200, int(w * h * 0.003))

        HLS_DIR = "public/banner"

        if frame_records:
            # Concat-demuxer playlist with per-frame durations derived from CDP
            # wall-clock timestamps. The trailing repeat gives ffmpeg a definite
            # end-PTS for the last frame (otherwise it'd inherit zero duration).
            with open(CONCAT_LIST, "w") as f:
                for i, (ts, name) in enumerate(frame_records):
                    f.write(f"file '{name}'\n")
                    if i + 1 < len(frame_records):
                        f.write(f"duration {frame_records[i + 1][0] - ts:.6f}\n")
                f.write(f"file '{frame_records[-1][1]}'\n")

            # Single encode pass: CDP JPEG frames → H.264 HLS, no intermediate
            # WebM. `fps=30` resamples the variable-rate CDP source to a
            # constant 30 fps (the screencast drops frames during idle).
            # `-force_key_frames` aligns I-frames with segment boundaries so
            # ABR switches don't tear. CRF + maxrate gives much better
            # perceptual quality than a pure CBR target.
            print("Encoding HLS ladder (H.264 fMP4, 3 renditions) from CDP frames...")
            shutil.rmtree(HLS_DIR, ignore_errors=True)
            os.makedirs(HLS_DIR, exist_ok=True)
            high_maxrate = _maxrate_k(HIGH_W, HIGH_H)
            mid_maxrate = _maxrate_k(MID_W, MID_H)
            low_maxrate = _maxrate_k(LOW_W, LOW_H)
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", CONCAT_LIST,
                    "-filter_complex",
                    (
                        f"[0:v]fps=30,{CROP},split=3[v1][v2][v3];"
                        f"[v1]scale={HIGH_W}:{HIGH_H}[v1out];"
                        f"[v2]scale={MID_W}:{MID_H}[v2out];"
                        f"[v3]scale={LOW_W}:{LOW_H}[v3out]"
                    ),
                    "-map", "[v1out]",
                    "-c:v:0", "libx264",
                    "-crf:v:0", "18",
                    "-maxrate:v:0", f"{high_maxrate}k",
                    "-bufsize:v:0", f"{high_maxrate * 2}k",
                    "-profile:v:0", "high",
                    "-map", "[v2out]",
                    "-c:v:1", "libx264",
                    "-crf:v:1", "20",
                    "-maxrate:v:1", f"{mid_maxrate}k",
                    "-bufsize:v:1", f"{mid_maxrate * 2}k",
                    "-profile:v:1", "main",
                    "-map", "[v3out]",
                    "-c:v:2", "libx264",
                    "-crf:v:2", "22",
                    "-maxrate:v:2", f"{low_maxrate}k",
                    "-bufsize:v:2", f"{low_maxrate * 2}k",
                    "-profile:v:2", "main",
                    "-preset", "slow",
                    "-pix_fmt", "yuv420p",
                    "-g", "120",
                    "-keyint_min", "120",
                    "-sc_threshold", "0",
                    "-force_key_frames", "expr:gte(t,n_forced*4)",
                    "-an",
                    "-f", "hls",
                    "-hls_time", "4",
                    "-hls_playlist_type", "vod",
                    "-hls_segment_type", "fmp4",
                    "-hls_flags", "independent_segments",
                    "-master_pl_name", "master.m3u8",
                    "-hls_segment_filename", f"{HLS_DIR}/v%v/segment_%03d.m4s",
                    "-var_stream_map", "v:0,name:high v:1,name:mid v:2,name:low",
                    f"{HLS_DIR}/v%v/playlist.m3u8",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            # Poster frame a couple seconds in so it captures actual content
            # (post-tile-bloom) rather than the still first frame.
            print("Extracting poster image...")
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", CONCAT_LIST,
                    "-ss", "2",
                    "-vf", f"{CROP},scale={HIGH_W}:{HIGH_H}",
                    "-vframes", "1",
                    "-q:v", "3",
                    "public/banner_image.jpeg",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
