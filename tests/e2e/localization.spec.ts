import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Chinese preserves lesson, experiment and local progress when switching language", async ({
  page,
}) => {
  await page.goto("/?lang=zh-CN&lesson=1&geometry=sphere&size=1");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("angle-sum")).toHaveText("270.0°");
  await page
    .getByRole("combobox", { name: "Language / 语言" })
    .selectOption("ru");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByTestId("angle-sum")).toHaveText("270,0°");
  await page
    .getByRole("combobox", { name: "Language / 语言" })
    .selectOption("zh-CN");
  await page.reload();
  await expect(page.getByTestId("angle-sum")).toHaveText("270.0°");
  expect(new URL(page.url()).searchParams.get("lang")).toBe("zh-CN");
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Chinese views accessible and translated at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const url of [
      "/?lang=zh-CN",
      "/?lang=zh-CN&view=lab&lab=geometry&geometry=hyperbolic&level=research",
      "/?lang=zh-CN&view=lab&lab=threebody&level=research",
      "/?lang=zh-CN&view=library",
    ]) {
      await page.goto(url);
      const body = (await page.locator("body").innerText()).replace(
        "Русский",
        "",
      );
      expect(body).not.toMatch(/[А-Яа-яЁё]/);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
    await page.screenshot({
      path: `docs/acceptance/zh-${viewport.width}-library.png`,
      fullPage: true,
    });
    await page.goto("/?lang=zh-CN");
    await page.screenshot({
      path: `docs/acceptance/zh-${viewport.width}-journey.png`,
      fullPage: true,
    });
  });
}
test("44px targets and text-spacing survive compact layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const el of await page
    .locator(
      ".topbar button,.topbar select,.segmented button,.level-button,input[type=range],.primary-button",
    )
    .all()) {
    const rect = await el.boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({
    content:
      "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('200% text reflows on the narrow screen in both languages', async ({page})=>{
 await page.setViewportSize({width:320,height:900});
 for (const lang of ['ru','zh-CN']) {
  for (const view of ['journey','lab','library']) {
   await page.goto(`/?lang=${lang}&view=${view}`);
   await page.addStyleTag({content:'html{font-size:200%}'});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
});
