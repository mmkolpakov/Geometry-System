import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const lang of ["ru", "zh-CN"] as const) {
  test(`${lang}: explore solar bodies, switch stars and share a paused system`, async ({
    page,
    context,
  }) => {
    await page.goto(`/?lang=${lang}`);
    await expect(
      page.locator('[data-testid="system-canvas"] canvas'),
    ).toBeVisible();
    await expect(page.locator(".system-body-list button")).toHaveCount(9);
    await page.locator(".system-body-list button").nth(6).click();
    await expect(page.locator(".system-details h2")).toHaveText(
      lang === "ru" ? "Сатурн" : "土星",
    );
    const status = page.getByTestId("system-status"),
      time = page.getByTestId("system-time");
    await page
      .getByRole("button", {
        name: lang === "ru" ? "На шаг вперёд" : "单步",
        exact: true,
      })
      .click();
    await expect(time).not.toContainText(lang === "ru" ? "0,00" : "0.00");
    await page
      .getByRole("button", {
        name: lang === "ru" ? "Три солнца" : "三颗太阳",
        exact: true,
      })
      .click();
    await expect(page.locator(".system-body-list button")).toHaveCount(4);
    await expect(page.locator(".system-details h2")).toHaveText(
      lang === "ru" ? "Пробная планета" : "测试行星",
    );
    await page
      .getByRole("button", {
        name: lang === "ru" ? "Пуск" : "开始",
        exact: true,
      })
      .click();
    await expect(time).not.toContainText(lang === "ru" ? "0,00" : "0.00");
    await page
      .getByRole("button", {
        name: lang === "ru" ? "Пауза" : "暂停",
        exact: true,
      })
      .click();
    const saved = await time.innerText(),
      url = page.url();
    await expect(status).toHaveText(lang === "ru" ? "На паузе" : "已暂停");
    const receiver = await context.newPage();
    await receiver.goto(url);
    await expect(receiver.getByTestId("system-time")).toHaveText(saved);
    await expect(receiver.getByTestId("system-status")).toHaveText(
      lang === "ru" ? "На паузе" : "已暂停",
    );
    await receiver.close();
    await page
      .getByRole("button", {
        name: lang === "ru" ? "В начало" : "重置",
        exact: true,
      })
      .click();
    await expect(time).toContainText(lang === "ru" ? "0,00" : "0.00");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
}

test("system overview fits a narrow screen and accepts keyboard controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=systems");
  await expect(
    page.locator('[data-testid="system-canvas"] canvas'),
  ).toBeVisible();
  expect(
    await page
      .locator(".system-stage")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(350);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const button = page.getByRole("button", { name: "Сверху", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-pressed", "true");
});

test("physical scale follows the selected body through selection and resize", async ({
  page,
}) => {
  await page.goto("/?view=systems");
  await page
    .getByRole("button", { name: "Масштаб для обзора", exact: true })
    .click();
  await page.getByRole("button", { name: "Крупный план", exact: true }).click();
  const label = page.locator(".system-stage-label");
  async function expectCentered() {
    await expect
      .poll(async () =>
        page.locator(".system-stage").evaluate((stage) => {
          const label = stage.querySelector(
            ".system-stage-label",
          ) as HTMLElement;
          return Math.abs(
            Number.parseFloat(label.style.left) - stage.clientWidth / 2,
          );
        }),
      )
      .toBeLessThan(4);
  }
  await expect(label).toHaveText("Земля");
  await expectCentered();
  await page.getByRole("button", { name: "Сатурн", exact: true }).click();
  await expect(label).toHaveText("Сатурн");
  await expectCentered();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectCentered();
  await page.getByRole("button", { name: "Сверху", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Крупный план", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
