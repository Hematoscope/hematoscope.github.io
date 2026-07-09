import { test, expect } from "@playwright/test";

test("home page opens", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cellbytes/);
});

test.describe("desktop", { tag: "@desktop" }, () => {
  test.skip(({ isMobile }) => isMobile);

  test("navigation is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("list").getByRole("link"),
    ).toHaveCount(4);
  });
});

test.describe("mobile", { tag: "@mobile" }, () => {
  test.skip(({ isMobile }) => !isMobile);

  test("page fits the viewport without zooming out", async ({ page }) => {
    await page.goto("/");

    // Decorative background SVGs overflow the viewport on purpose. If that
    // overflow ever becomes scrollable again, mobile browsers zoom out to
    // fit the whole document and the site renders tiny.
    const metrics = await page.evaluate(() => ({
      scale: window.visualViewport?.scale ?? 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scale).toBeGreaterThan(0.99);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("navigation is available", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("navigation")).not.toBeVisible();
    const menuButton = page.getByRole("button", { name: /menu/ });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("list").getByRole("link"),
    ).toHaveCount(4);

    await menuButton.click();
    await expect(page.getByRole("navigation")).not.toBeVisible();
  });
});
