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
