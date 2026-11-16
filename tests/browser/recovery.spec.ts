import { test, expect } from "@playwright/test";
test("Grundversorgung erholt sich in der aktiven Auswahl und nach Fortsetzen", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "Neue Stadt", exact: true }).click();
  const canvas = page.locator("#world canvas");
  const inspector = page.locator("#inspect");
  let x = 16,
    y = 16;
  async function moveTo(nx: number, ny: number) {
    await canvas.focus();
    while (x !== nx) {
      await canvas.press(x < nx ? "ArrowRight" : "ArrowLeft");
      x += x < nx ? 1 : -1;
    }
    while (y !== ny) {
      await canvas.press(y < ny ? "ArrowDown" : "ArrowUp");
      y += y < ny ? 1 : -1;
    }
  }
  async function build(kind: string, nx: number, ny: number) {
    await page.locator(`[data-kind="${kind}"]`).click();
    await moveTo(nx, ny);
    await canvas.press("Enter");
    await expect(page.locator("#notice")).toHaveText("✓ Bauauftrag ausgeführt");
  }
  async function inspectAt(nx: number, ny: number) {
    await moveTo(nx, ny);
    await canvas.press("i");
  }
  for (let nx = 16; nx <= 20; nx++) await build("road", nx, 16);
  for (const [i, kind] of ["farm", "well", "wind", "market", "home"].entries())
    await build(kind, 16 + i, 15);
  await inspectAt(20, 15);
  await expect(inspector).toContainText("✓");
  await expect(inspector).toContainText(/[1-8] Einwohner/);
  await expect(page.locator("#supplies")).toContainText("100 %");

  // Pause makes the one-time inspection happen before the next economy round.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator("#demolish").click();
  await moveTo(17, 15);
  await canvas.press("Enter");
  await expect(page.locator("#notice")).toHaveText("✓ Bauauftrag ausgeführt");
  await inspectAt(20, 15);
  await expect(inspector).toContainText("✓");
  await page.locator('[data-speed="1"]').click();
  await expect(inspector).toContainText("Wasser fehlt");
  await build("well", 17, 15);
  // No second selection: the inspector must follow worker updates on its own.
  await expect(inspector).toContainText("✓");
  await expect(page.locator("#supplies")).toContainText("100 %");

  // I on an empty tile must select inspection even when a build tool is active.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator('[data-kind="road"]').click();
  const money = await page.locator("#money").textContent();
  await inspectAt(21, 15);
  await expect(page.locator("#inspectTitle")).toHaveText(
    "Freies Feld · 21, 15",
  );
  await canvas.press("Enter");
  await expect(page.locator("#inspectTitle")).toHaveText(
    "Freies Feld · 21, 15",
  );
  await expect(page.locator("#money")).toHaveText(money!);
  await page.locator('[data-kind="school"]').click();
  await canvas.press("Enter");
  await expect(page.locator("#notice")).toContainText("32 Einwohnern");
  await expect(page.locator("#money")).toHaveText(money!);

  await inspectAt(20, 15);
  await expect(inspector).toContainText("✓");
  const residents = Number(
    (await inspector.textContent())!.match(/(\d+) Einwohner/)![1],
  );
  await page.locator("#menuButton").click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#menuStatus")).toHaveText(
    "Spielstand gespeichert.",
  );
  await page.reload();
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await expect(page.locator("#menu")).not.toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  x = 16;
  y = 16;
  await inspectAt(20, 15);
  // Fortsetzen starts the clock. A round can finish before Pause is processed.
  await expect(inspector).toContainText(/\d+ Einwohner/);
  const resumedResidents = Number(
    (await inspector.textContent())!.match(/(\d+) Einwohner/)![1],
  );
  expect(resumedResidents).toBeGreaterThanOrEqual(residents);
  await expect(inspector).toContainText("✓");
  await page.locator('[data-kind="school"]').click();
  await moveTo(21, 15);
  await canvas.press("Enter");
  await expect(page.locator("#notice")).toContainText("32 Einwohnern");
  await page.locator('[data-kind="mine"]').click();
  await canvas.press("Enter");
  await expect(page.locator("#notice")).toContainText("64 Einwohnern");
  await page.locator('[data-kind="road"]').click();
  await moveTo(20, 15);
  await canvas.press("Enter");
  await expect(page.locator("#notice")).toContainText("Feld belegt");
  await page.locator('[data-speed="1"]').click();
  await expect(page.locator("#supplies")).toContainText("100 %");
});
