import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => localStorage.clear());
  test
    .info()
    .annotations.push({
      type: "runtime-errors",
      description:
        "Console and uncaught browser errors are checked after every test.",
    });
  (page as Page & { runtimeErrors: string[] }).runtimeErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { runtimeErrors: string[] }).runtimeErrors).toEqual(
    [],
  );
});

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function accessible(page: Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

test("all geometries, intrinsic measurements, keyboard control and research layer", async ({
  page,
}) => {
  await page.goto("/?view=lab&lab=geometry&geometry=flat&size=1");
  await expect(page.getByTestId("angle-sum")).toHaveText("180,0°");
  await page.getByRole("button", { name: "Сфера", exact: true }).click();
  await expect(page.getByTestId("angle-sum")).toHaveText("270,0°");
  await page
    .getByRole("button", { name: "Гиперболическая", exact: true })
    .click();
  const sum = Number(
    (await page.getByTestId("angle-sum").innerText())
      .replace("°", "")
      .replace(",", "."),
  );
  expect(sum).toBeGreaterThan(0);
  expect(sum).toBeLessThan(180);
  const slider = page.getByRole("slider", { name: "Размер треугольника" });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0.25");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("0.26");
  await page.getByRole("button", { name: "Формулы и метод" }).click();
  await expect(
    page.getByText("Измерение на поверхности", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("α + β + γ − π = K · A", { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await noOverflow(page);
});

test("journey quiz persists completed progress and advances to the next experiment", async ({
  page,
}) => {
  await page.goto("/?view=journey");
  await expect(
    page.getByText("Проверено: 0 из 6", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Проверить вывод" }),
  ).toBeDisabled();
  await page
    .getByRole("radio", { name: "По геометрии поверхности сферы." })
    .check();
  await page.getByRole("button", { name: "Проверить вывод" }).click();
  await expect(page.getByText("Ответ проверен", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Проверено: 1 из 6", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kontur.progress.v1") || "[]"),
    ),
  ).toContain("straight-path");
  // A new tab reads the progress stored by the completed experience.
  const secondPage = await page.context().newPage();
  await secondPage.goto(page.url());
  await expect(
    secondPage.getByText("Проверено: 1 из 6", { exact: true }),
  ).toBeVisible();
  await secondPage.close();
  await page.getByRole("button", { name: "Следующий опыт" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Может ли треугольник иметь три угла по 90°?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Сфера", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("radio").first()).not.toBeChecked();
});

test("all route lessons open the matching laboratory and supply answer feedback", async ({
  page,
}) => {
  await page.goto("/?view=journey");
  const lessonButtons = page.locator(".lesson-list button");
  await expect(lessonButtons).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await lessonButtons.nth(index).click();
    await expect(lessonButtons.nth(index)).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(
      page.getByTestId(index < 3 ? "geometry-visual" : "threebody-visual"),
    ).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Проверить вывод" }).click();
    await expect(page.locator(".feedback")).not.toBeEmpty();
  }
});

test("returning from free exploration restores the selected lesson laboratory", async ({
  page,
}) => {
  await page.goto("/?view=journey");
  await page.getByRole("button", { name: "Лаборатория", exact: true }).click();
  await page.getByRole("button", { name: "Три тела", exact: true }).click();
  await expect(page.getByTestId("threebody-visual")).toBeVisible();
  await page.getByRole("button", { name: "Маршрут", exact: true }).click();
  await expect(page.getByTestId("geometry-visual")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Почему кратчайший путь может выглядеть дугой?",
    }),
  ).toBeVisible();
  await page.locator(".lesson-list button").nth(3).click();
  await expect(page.getByTestId("threebody-visual")).toBeVisible();
  await page.getByRole("button", { name: "Лаборатория", exact: true }).click();
  await page.getByRole("button", { name: "Геометрия", exact: true }).click();
  await expect(page.getByTestId("geometry-visual")).toBeVisible();
  await page.getByRole("button", { name: "Маршрут", exact: true }).click();
  await expect(page.getByTestId("threebody-visual")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Треугольник Лагранжа", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("direct lesson URL infers its laboratory and preset without redundant parameters", async ({
  page,
}) => {
  await page.goto("/?lesson=5");
  await expect(page.getByTestId("threebody-visual")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Неустойчивая тройка", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".lesson-list button").nth(5)).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.goto("/?lesson=2");
  await expect(page.getByTestId("geometry-visual")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Гиперболическая", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dimension-visual")).toBeVisible();
});

test("share URL restores model, parameters and research layer", async ({
  page,
}) => {
  await page.goto(
    "/?v=1&view=lab&lab=geometry&geometry=hyperbolic&size=0.64&level=research&lesson=2",
  );
  await expect(
    page.getByRole("button", { name: "Гиперболическая", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("slider", { name: "Размер треугольника" }),
  ).toHaveValue("0.64");
  await expect(
    page.getByText("Измерение на поверхности", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("slider", { name: "Размер треугольника" }),
  ).toHaveValue("0.64");
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Размер треугольника" }),
  ).toHaveValue("0.75");
  await expect(
    page.getByRole("button", { name: "Плоскость", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("invalid shared parameters and unavailable storage preserve a usable experience", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    }),
  );
  await page.goto(
    "/?view=journey&lab=invalid&geometry=wrong&size=Infinity&lesson=-8",
  );
  await expect(
    page.getByRole("heading", { name: "Геометрия и движение" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Плоскость", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("slider", { name: "Размер треугольника" }),
  ).toHaveValue("0.75");
  await page
    .getByRole("radio", { name: "По геометрии поверхности сферы." })
    .check();
  await page.getByRole("button", { name: "Проверить вывод" }).click();
  await expect(page.getByText("Ответ проверен", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Проверено: 1 из 6", { exact: true }),
  ).toBeVisible();
});

test("share copies the exact reproducible experiment URL", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/?v=1&view=lab&lab=geometry&geometry=sphere&size=0.91&level=research",
  );
  await page
    .getByRole("button", { name: "Поделиться опытом", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ссылка скопирована", exact: true }),
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(page.url());
  expect(new URL(copied).searchParams.get("size")).toBe("0.91");
});

test("shared three-body comparison restores perturbation and frame paused", async ({
  page,
}) => {
  await page.goto(
    "/?v=1&view=lab&lab=threebody&preset=figure-eight&compare=1&dv=4&frame=120&level=research",
  );
  await expect(
    page.getByRole("checkbox", {
      name: "Сравнить с небольшим изменением скорости",
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Изменение начальной скорости Δvₓ" }),
  ).toHaveValue("4");
  await expect(page.getByRole("slider", { name: "Время модели" })).toHaveValue(
    "120",
  );
  await expect(page.getByTestId("playback-status")).toHaveText("На паузе");
  await expect(page.getByTestId("simulation-time")).not.toHaveText("0,00");
  const savedTime = await page.getByTestId("simulation-time").innerText();
  await expect(page.locator(".comparison-result")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("simulation-time")).toHaveText(savedTime);
  await expect(
    page.getByRole("slider", { name: "Изменение начальной скорости Δvₓ" }),
  ).toHaveValue("4");
  await expect(page.getByTestId("playback-status")).toHaveText("На паузе");
  await expect(
    page.getByRole("table", { name: /Положения в момент/ }),
  ).toBeVisible();
});

test("three-body playback, step, seek, comparison, presets and reset", async ({
  page,
}) => {
  await page.goto("/?view=lab&lab=threebody&preset=figure-eight");
  await expect(page.getByTestId("playback-status")).toHaveText("На паузе");
  await expect(page.getByTestId("simulation-time")).toHaveText("0,00");
  await page.getByRole("button", { name: "Шаг", exact: true }).click();
  await expect(page.getByTestId("simulation-time")).not.toHaveText("0,00");
  await page.getByRole("button", { name: "Сброс", exact: true }).click();
  await expect(page.getByTestId("simulation-time")).toHaveText("0,00");
  await page.getByRole("button", { name: "Запустить", exact: true }).click();
  await expect(page.getByTestId("playback-status")).toHaveText(
    "Воспроизведение",
  );
  await expect
    .poll(async () => {
      expect(await page.getByTestId("playback-status").innerText()).toBe(
        "Воспроизведение",
      );
      return Number(
        (await page.getByTestId("simulation-time").innerText()).replace(
          ",",
          ".",
        ),
      );
    })
    .toBeGreaterThanOrEqual(0.5);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(page.getByTestId("playback-status")).toHaveText("На паузе");
  await page.getByRole("slider", { name: "Время модели" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("playback-status")).toHaveText(
    "Последний кадр",
  );
  await page
    .getByRole("checkbox", { name: "Сравнить с небольшим изменением скорости" })
    .check();
  await expect(page.getByTestId("simulation-time")).toHaveText("0,00");
  await expect(page.locator(".comparison-result")).toBeVisible();
  const perturbation = page.getByRole("slider", {
    name: "Изменение начальной скорости Δvₓ",
  });
  await perturbation.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(perturbation).toHaveValue("3");
  await expect(perturbation).toBeFocused();
  await expect(page.getByTestId("playback-status")).toHaveText("На паузе");
  await page
    .getByRole("button", { name: "Треугольник Лагранжа", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Треугольник Лагранжа", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("simulation-time")).toHaveText("0,00");
  await expect(
    page.getByRole("checkbox", {
      name: "Сравнить с небольшим изменением скорости",
    }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Неустойчивая тройка", exact: true })
    .click();
  await expect(page.getByTestId("threebody-visual")).toBeVisible();
  await page.getByRole("button", { name: "Формулы и метод" }).click();
  await expect(
    page.getByRole("table", { name: /Положения в момент/ }),
  ).toBeVisible();
  await accessible(page);
  await noOverflow(page);
});

test("library navigation gives primary sources and model boundaries", async ({
  page,
}) => {
  await page.goto("/?view=journey");
  await page.getByRole("button", { name: "Источники", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Модели и источники" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Геометрия поверхности" }),
  ).toBeVisible();
  expect(await page.locator(".source-list a").count()).toBeGreaterThanOrEqual(
    5,
  );
  for (const link of await page.locator(".source-list a").all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  }
  await accessible(page);
  await noOverflow(page);
});

test("comparison perturbation retains keyboard focus across repeated adjustments", async ({
  page,
}) => {
  await page.goto(
    "/?view=lab&lab=threebody&preset=figure-eight&compare=1&dv=1",
  );
  const perturbation = page.getByRole("slider", {
    name: "Изменение начальной скорости Δvₓ",
  });
  await perturbation.focus();
  await page.keyboard.press("ArrowRight");
  await expect(perturbation).toHaveValue("2");
  await expect(perturbation).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(perturbation).toHaveValue("3");
  await expect(perturbation).toBeFocused();
  await expect(page.getByTestId("simulation-time")).toHaveText("0,00");
  await expect(page.getByTestId("playback-status")).toHaveText("На паузе");
});

test("mobile observer sky follows simulation time and exposes quantitative readings", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=lab&lab=threebody&preset=figure-eight");
  await page
    .getByRole("checkbox", {
      name: "Небо неподвижного наблюдателя",
      exact: true,
    })
    .check();
  await expect(page.getByTestId("observer-sky")).toBeVisible();
  const initialFlux = await page.getByTestId("observer-flux").innerText();
  const initialReadings = await page
    .getByTestId("observer-sky")
    .locator("tbody")
    .innerText();
  await page.getByRole("slider", { name: "Время модели" }).focus();
  for (let i = 0; i < 30; i += 1) await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("simulation-time")).not.toHaveText("0,00");
  await expect(page.getByTestId("observer-flux")).not.toHaveText(initialFlux);
  expect(
    await page.getByTestId("observer-sky").locator("tbody").innerText(),
  ).not.toBe(initialReadings);
  await expect(
    page.getByRole("table", {
      name: "Мгновенные направления и условный поток",
    }),
  ).toBeVisible();
  await accessible(page);
  await noOverflow(page);
  await page.getByRole("heading", { level: 1 }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("mobile-observer.png"),
    fullPage: true,
  });
  await page
    .getByRole("checkbox", {
      name: "Небо неподвижного наблюдателя",
      exact: true,
    })
    .uncheck();
  await expect(page.getByTestId("observer-sky")).toHaveCount(0);
});

test("mobile dimension projection changes screen distance while spatial distance stays invariant", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=journey&lesson=2&lab=geometry&geometry=hyperbolic");
  const distances = page.getByTestId("projection-distance").locator("strong");
  await expect(page.getByTestId("dimension-visual")).toBeVisible();
  await expect(distances.nth(0)).toHaveText("2,00");
  await expect(distances.nth(1)).toHaveText("0,00");
  await page.getByRole("slider", { name: /Поворот объекта/ }).focus();
  await page.keyboard.press("End");
  await expect(distances.nth(0)).toHaveText("2,00");
  await expect(distances.nth(1)).toHaveText("2,00");
  await accessible(page);
  await noOverflow(page);
  await page.getByRole("heading", { level: 1 }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("mobile-projection.png"),
    fullPage: true,
  });
  await page.getByRole("slider", { name: /Поворот объекта/ }).focus();
  await page.keyboard.press("Home");
  await expect(distances.nth(1)).toHaveText("0,00");
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`layout and keyboard access: ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/?view=journey");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "К содержимому" }),
    ).toBeFocused();
    await expect(
      page.getByRole("link", { name: "К содержимому" }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await page.getByRole("heading", { level: 1 }).click();
    await accessible(page);
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-journey.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Лаборатория", exact: true })
      .click();
    await expect(page.getByTestId("geometry-visual")).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-geometry.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Три тела", exact: true }).click();
    await expect(page.getByTestId("threebody-visual")).toBeVisible();
    await accessible(page);
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-threebody.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Источники", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Модели и источники" }),
    ).toBeVisible();
    await accessible(page);
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-library.png`),
      fullPage: true,
    });
  });
}
