import { expect, test } from '@playwright/test';

const narrative = {
  ru: /Солнечная система теряет пространственную размерность|В эпизоде игры с Вэнь-ваном|программа «Отвернувшиеся»|В «Вечной жизни» меняется размерность/,
  'zh-CN': /太阳系失去一个空间维度|在游戏中，周文王|面壁计划利用了一个限制|《死神永生》描写了空间维数的改变/,
};

for (const lang of ['ru', 'zh-CN'] as const) {
  test(`${lang}: direct lesson links expose science without plot or literary links`, async ({ page }) => {
    for (let lesson = 0; lesson < 6; lesson += 1) {
      await page.goto(`/?lang=${lang}&lesson=${lesson}&spoilers=1&story=1&consent=1`);
      await expect(page.getByTestId('story-content')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toMatch(narrative[lang]);
      await expect(page.locator('.context-source')).toHaveCount(0);
      await expect(page.getByTestId(lesson < 3 ? 'geometry-visual' : 'threebody-visual')).toBeVisible();
      await expect(page.getByRole('radio')).toHaveCount(3);
    }
    await page.goto(`/?lang=${lang}&lesson=2`);
    await expect(page.getByTestId('dimension-visual')).toBeVisible();
    expect(await page.locator('.lesson-list').innerText()).not.toMatch(narrative[lang]);
  });

  test(`${lang}: narrative requires local disclosure and is not inherited by Next, Back or receiver`, async ({ page, context }) => {
    await page.goto(`/?lang=${lang}&lesson=2`);
    const show = lang === 'ru' ? 'Показать сюжетный контекст' : '显示剧情背景';
    const hide = lang === 'ru' ? 'Скрыть сюжетный контекст' : '隐藏剧情背景';
    const button = page.getByRole('button', { name: show, exact: true });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(page.getByTestId('story-content')).toHaveCount(1);
    expect(await page.getByTestId('story-content').innerText()).toMatch(narrative[lang]);
    await expect(page.getByRole('button', { name: hide, exact: true })).toHaveAttribute('aria-expanded', 'true');

    const shared = page.url();
    expect(new URL(shared).searchParams.has('consent')).toBe(false);
    const receiver = await context.newPage();
    await receiver.goto(shared);
    await expect(receiver.getByTestId('story-content')).toHaveCount(0);
    await receiver.close();

    await page.getByRole('button', { name: lang === 'ru' ? 'Следующий опыт' : '下一个实验', exact: true }).click();
    await expect(page.getByTestId('story-content')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('.lesson-list button').nth(2)).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('story-content')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('story-content')).toHaveCount(0);

    // A new history entry for the same lesson must not reuse previously given consent.
    await page.getByRole('button', { name: show, exact: true }).click();
    await page.locator('.lesson-list button').nth(2).click();
    await expect(page.getByTestId('story-content')).toHaveCount(0);
    await page.getByRole('button', { name: show, exact: true }).click();
    await expect(page.getByTestId('story-content')).toHaveCount(1);
    await page.goBack();
    await expect(page.locator('.lesson-list button').nth(2)).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('story-content')).toHaveCount(0);

    await page.getByRole('button', { name: show, exact: true }).click();
    await expect(page.getByTestId('story-content')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Language / 语言' }).selectOption(lang === 'ru' ? 'zh-CN' : 'ru');
    await expect(page.getByTestId('story-content')).toHaveCount(0);
  });

  test(`${lang}: literary sources in the library are behind consent`, async ({ page }) => {
    await page.goto(`/?lang=${lang}&view=library`);
    await expect(page.locator('.source-list a')).toHaveCount(5);
    await expect(page.locator('a[href*="macmillan.com"]')).toHaveCount(0);
    await page.getByRole('button', { name: lang === 'ru' ? 'Показать сюжетный контекст' : '显示剧情背景', exact: true }).click();
    await expect(page.getByTestId('story-content').locator('a[href*="macmillan.com"]')).toBeVisible();
  });
}
