import { test, expect } from "@playwright/test";

test("lesson changes focus the new heading and browser Back restores the prior lesson", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const before = await page.evaluate(() => history.length);
  await page
    .getByRole("button", { name: "Следующий опыт", exact: true })
    .click();
  const heading = page.getByRole("heading", {
    name: "Может ли треугольник иметь три угла по 90°?",
  });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  const slider = page.getByRole("slider", { name: "Размер треугольника" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.goBack();
  await expect(
    page.getByRole("heading", {
      name: "Почему кратчайший путь может выглядеть дугой?",
    }),
  ).toBeFocused();
});

test("brand retains Chinese and clipboard denial exposes a usable link in every view", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    }),
  );
  for (const view of ["journey", "lab", "library"]) {
    await page.goto(`/?lang=zh-CN&view=${view}`);
    await page.getByRole("button", { name: "分享实验", exact: true }).click();
    await expect(page.locator(".share-fallback [role=status]")).toContainText(
      "手动复制",
    );
    await expect(page.getByRole("textbox", { name: "实验链接" })).toHaveValue(
      page.url(),
    );
    await page.getByRole("button", { name: "选择链接", exact: true }).click();
    expect(
      await page
        .getByRole("textbox", { name: "实验链接" })
        .evaluate((e: HTMLInputElement) => e.selectionEnd! - e.selectionStart!),
    ).toBe(page.url().length);
  }
  await page.locator(".brand").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator(".lesson-list button").first()).toHaveAttribute(
    "aria-current",
    "step",
  );
});

test("incorrect answers stay retryable, progress merges across tabs and reset is explicit", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const other = await context.newPage();
  await other.goto("/?lesson=1");
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Проверить вывод" }).click();
  await expect(page.locator(".feedback")).toContainText("Пока не совсем");
  await expect(page.locator(".progress-label")).toContainText("0 из 6");
  await page
    .getByRole("radio", { name: "По геометрии поверхности сферы." })
    .check();
  await page.getByRole("button", { name: "Проверить вывод" }).click();
  await expect(page.locator(".feedback")).toContainText("Верно.");
  await other.getByRole("radio").nth(1).check();
  await other.getByRole("button", { name: "Проверить вывод" }).click();
  await expect(page.locator(".progress-label")).toContainText("2 из 6");
  await expect(other.locator(".progress-label")).toContainText("2 из 6");
  await page.getByRole("button", { name: "Сбросить учебный прогресс" }).click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.locator(".progress-label")).toContainText("2 из 6");
  await page.getByRole("button", { name: "Сбросить учебный прогресс" }).click();
  await page
    .getByRole("button", { name: "Удалить отметки", exact: true })
    .click();
  await expect(other.locator(".progress-label")).toContainText("0 из 6");
  await other.close();
});

test("comparison uses one fixed camera and distinguishes retained frames from solver queries", async ({
  page,
}) => {
  await page.goto("/?view=lab&lab=threebody&preset=chaotic&level=research");
  const marker = page
    .getByTestId("threebody-visual")
    .locator("g circle")
    .last();
  const initial = await marker.evaluate((e) => ({
    x: e.getAttribute("cx"),
    y: e.getAttribute("cy"),
  }));
  await page
    .getByRole("checkbox", { name: "Сравнить близкие начальные условия" })
    .check();
  const delta = page.getByRole("slider", {
    name: "Изменение начальной скорости Δvₓ",
  });
  await delta.focus();
  await page.keyboard.press("End");
  expect(
    await marker.evaluate((e) => ({
      x: e.getAttribute("cx"),
      y: e.getAttribute("cy"),
    })),
  ).toEqual(initial);
  await expect(page.getByTestId("frame-cadence")).toContainText("0,036");
  await expect(page.getByText(/Сетка запросов к решателю/)).toContainText(
    "0,004",
  );
});

test("comparison reports the numerical quality of both solutions independently", async ({
  page,
}) => {
  await page.goto(
    "/?view=lab&lab=threebody&preset=chaotic&compare=1&frame=300",
  );
  const baseline = await page.getByTestId("baseline-diagnostics").textContent();
  const compared = await page
    .getByTestId("perturbed-diagnostics")
    .textContent();
  const slider = page.getByRole("slider", {
    name: "Изменение начальной скорости Δvₓ",
  });
  await slider.focus();
  await page.keyboard.press("End");
  // Changing conditions resets time; return to the same retained time before comparing quality.
  await page.getByRole("slider", { name: "Время модели" }).fill("300");
  await expect(page.getByTestId("baseline-diagnostics")).toHaveText(baseline!);
  await expect(page.getByTestId("perturbed-diagnostics")).not.toHaveText(
    compared!,
  );
  await expect(page.getByTestId("comparison-diagnostics")).toBeVisible();
});
