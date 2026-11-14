import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { zhUI } from "./content/ui.zh";
import { zhLabs } from "./content/labs.zh";

export type Locale = "ru" | "zh-CN";

/** The two shipped languages are explicit; no network language detection is used. */
export function languageFrom(value: string | null | undefined): Locale {
  return /^zh(?:[-_]|$)/i.test(value?.trim() ?? "") ? "zh-CN" : "ru";
}

export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  lng: "ru",
  fallbackLng: "ru",
  supportedLngs: ["ru", "zh-CN"],
  load: "currentOnly",
  resources: {
    ru: { translation: {} },
    "zh-CN": { translation: { ...zhUI, ...zhLabs } },
  },
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  react: { useSuspense: false },
});

/** A fixed language avoids one render of the previous language after a switch. */
export function translate(phrase: string, locale: Locale): string {
  if (!phrase) return phrase;
  return String(i18n.getFixedT(locale)(phrase, { defaultValue: phrase }));
}

export function formatNumber(
  value: number,
  locale: Locale,
  digits = 2,
): string {
  const precision = Number.isFinite(digits)
    ? Math.max(0, Math.min(20, Math.trunc(digits)))
    : 2;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

type LocaleContextValue = {
  t: (phrase: string) => string;
  locale: Locale;
  number: (value: number, digits?: number) => string;
};

function localeValue(locale: Locale): LocaleContextValue {
  return {
    locale,
    t: (phrase) => translate(phrase, locale),
    number: (value, digits) => formatNumber(value, locale, digits),
  };
}

const LocaleContext = createContext<LocaleContextValue>(localeValue("ru"));

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(() => localeValue(locale), [locale]);

  useEffect(() => {
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
    document.title =
      locale === "zh-CN"
        ? "界线 · 可能世界实验室"
        : "Контур · Лаборатория возможных миров";
  }, [locale]);

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </I18nextProvider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
