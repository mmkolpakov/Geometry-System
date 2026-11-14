import { describe, expect, it } from 'vitest';
import { formatNumber, i18n, languageFrom, translate } from './i18n';

describe('shipped locales', () => {
  it('normalizes Chinese variants and defaults unsupported input to Russian', () => {
    for (const value of ['zh', 'zh-CN', 'zh-Hans', 'ZH_tw', ' zh-SG ']) {
      expect(languageFrom(value)).toBe('zh-CN');
    }
    for (const value of [null, undefined, '', 'ru', 'ru-RU', 'en', 'zhongwen']) {
      expect(languageFrom(value)).toBe('ru');
    }
  });

  it('uses the inline Chinese resource and keeps Russian phrases as the source', () => {
    expect(translate('Маршрут', 'zh-CN')).toBe('探索路径');
    expect(translate('Маршрут', 'ru')).toBe('Маршрут');
    expect(translate('Эта строка ещё не переведена: значение 1.5.', 'zh-CN'))
      .toBe('Эта строка ещё не переведена: значение 1.5.');
    expect(translate('', 'zh-CN')).toBe('');
  });

  it('treats punctuation as part of a phrase and never returns an empty translation', () => {
    const phrase = 'Научная подпись: x.y';
    i18n.addResource('zh-CN', 'translation', phrase, '科学说明：x.y');
    expect(translate(phrase, 'zh-CN')).toBe('科学说明：x.y');
    i18n.addResource('zh-CN', 'translation', 'Пустой перевод', '');
    expect(translate('Пустой перевод', 'zh-CN')).toBe('Пустой перевод');
  });

  it('binds every translation to its requested locale independently of global language', async () => {
    await i18n.changeLanguage('ru');
    expect(translate('Маршрут', 'zh-CN')).toBe('探索路径');
    await i18n.changeLanguage('zh-CN');
    expect(translate('Маршрут', 'ru')).toBe('Маршрут');
    await i18n.changeLanguage('ru');
  });

  it('formats numbers with locale-specific separators and an explicit precision', () => {
    expect(formatNumber(1234.5, 'ru', 2)).toBe('1\u00a0234,50');
    expect(formatNumber(1234.5, 'zh-CN', 2)).toBe('1,234.50');
    expect(formatNumber(270, 'zh-CN', 0)).toBe('270');
    expect(formatNumber(-0.125, 'ru', 3)).toBe('-0,125');
    expect(formatNumber(1.25, 'ru', Number.NaN)).toBe('1,25');
  });
});
