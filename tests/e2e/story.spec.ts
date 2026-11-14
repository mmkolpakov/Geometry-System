import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const lang of ["ru", "zh-CN"] as const) {
  test(`${lang}: follows the trilogy and keeps plot disclosure local`, async ({
    page,
    context,
  }) => {
    await page.goto(`/?view=story&chapter=9&lang=${lang}`);
    await expect(page.getByTestId("story-scene")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: lang === "ru" ? "Открыть историю" : "打开故事",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("story-scene")).toBeVisible();
    await expect(page.locator(".story-timeline button")).toHaveCount(12);
    const phases = page.getByRole("slider", {
      name: lang === "ru" ? "Шаг сцены" : "场景步骤",
    });
    await phases.fill("2");
    await expect(page.getByTestId("story-scene")).toHaveAttribute(
      "data-phase",
      "2",
    );
    await phases.fill("0");

    const receiver = await context.newPage();
    await receiver.goto(page.url());
    await expect(receiver.getByTestId("story-scene")).toHaveCount(0);
    await receiver.close();
    await page.locator(".story-timeline button").first().click();
    const next = page.getByRole("button", {
      name: lang === "ru" ? "Следующий эпизод" : "下一幕",
      exact: true,
    });
    const titles = [];
    for (let i = 0; i < 12; i++) {
      await expect(page.getByTestId("story-scene")).toBeVisible();
      titles.push(await page.locator(".story-heading h1").innerText());
      await expect(page.getByTestId("story-scene")).toHaveAttribute(
        "data-phase",
        "0",
      );
      if (i < 11) await next.click();
    }
    expect(new Set(titles).size).toBe(12);
    await expect(next).toBeDisabled();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page
      .getByRole("button", {
        name: lang === "ru" ? "Закрыть историю" : "关闭故事",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: lang === "ru" ? "Открыть историю" : "打开故事",
        exact: true,
      }),
    ).toBeFocused();
    await expect(page.getByTestId("story-scene")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
