import { LocaleProvider, useLocale } from "./i18n";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Layers3,
  Link2,
  Orbit,
  RotateCcw,
} from "lucide-react";
import { DimensionDemo } from "./features/DimensionDemo";
import { GeometryLab } from "./features/GeometryLab";
import { ThreeBodyLab } from "./features/ThreeBodyLab";
import { lessons as lessonsRu } from "./content/curriculum";
import { lessonsZh } from "./content/curriculum.zh";
import { sources as sourcesRu } from "./content/sources";
import { sourcesZh } from "./content/sources.zh";
import {
  defaults,
  readProgress,
  readSession,
  saveProgress,
  clearProgress,
  PROGRESS_KEY,
  sessionQuery,
  type Session,
} from "./state/session";

const StoryExplorer = lazy(() =>
  import("./features/StoryExplorer").then((module) => ({
    default: module.StoryExplorer,
  })),
);
const SystemScene = lazy(() =>
  import("./features/SystemScene").then((module) => ({
    default: module.SystemScene,
  })),
);

export default function App() {
  const [session, setSession] = useState(() => readSession(location.search));
  return (
    <LocaleProvider locale={session.language}>
      <AppContent session={session} setSession={setSession} />
    </LocaleProvider>
  );
}
/** Only mounted, in-memory consent opens narrative details; URLs never carry it. */
function StoryDisclosure({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [revealed, setRevealed] = useState(false);
  return (
    <section
      className="formula-card story-disclosure"
      aria-label={t("Литературный контекст и источники")}
    >
      <h3>{t("Связь с книгой — по желанию")}</h3>
      <p>
        {t(
          "Сюжетные подробности и ссылки могут раскрыть события трилогии. Научный опыт и вопросы доступны без них.",
        )}
      </p>
      <button
        type="button"
        className="text-button"
        aria-expanded={revealed}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed
          ? t("Скрыть сюжетный контекст")
          : t("Показать сюжетный контекст")}
      </button>
      {revealed && <div data-testid="story-content">{children}</div>}
    </section>
  );
}

function AppContent({
  session,
  setSession,
}: {
  session: Session;
  setSession: React.Dispatch<React.SetStateAction<Session>>;
}) {
  const { t, locale, number } = useLocale();
  const lessons = locale === "zh-CN" ? lessonsZh : lessonsRu;
  const sources = locale === "zh-CN" ? sourcesZh : sourcesRu;
  const [completed, setCompleted] = useState(readProgress);
  const [answer, setAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState(false);
  const [resetPrompt, setResetPrompt] = useState(false);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [storyEpoch, setStoryEpoch] = useState(0);
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);
  const pushNavigation = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const resetButton = useRef<HTMLButtonElement>(null);
  const current = lessons[Math.min(session.lesson, lessons.length - 1)];
  const update = (patch: Partial<Session>) => {
    if (
      patch.view !== undefined ||
      patch.lesson !== undefined ||
      patch.storyChapter !== undefined
    ) {
      pushNavigation.current = true;
      focusNext.current = true;
      setStoryEpoch((value) => value + 1);
    }
    setSession((previous) => ({ ...previous, ...patch }));
  };
  useEffect(() => {
    const url = "?" + sessionQuery(session);
    if (pushNavigation.current) {
      history.pushState(null, "", url);
      pushNavigation.current = false;
    } else history.replaceState(null, "", url);
    if (focusNext.current) {
      focusNext.current = false;
      const target =
        session.view === "journey"
          ? lessonHeading.current
          : pageHeading.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [session]);
  useEffect(() => {
    const listener = () => {
      focusNext.current = true;
      setStoryEpoch((value) => value + 1);
      setSession(readSession(location.search));
    };
    const progressListener = (event: StorageEvent) => {
      if (event.key === PROGRESS_KEY || event.key === null)
        setCompleted(readProgress());
    };
    window.addEventListener("popstate", listener);
    window.addEventListener("storage", progressListener);
    return () => {
      window.removeEventListener("popstate", listener);
      window.removeEventListener("storage", progressListener);
      clearTimeout(copyTimer.current);
    };
  }, []);
  useEffect(() => {
    setAnswer(null);
    setFeedback("");
    setAnswerCorrect(null);
    setShareFallback(false);
  }, [session.lesson, session.view, locale]);
  function openLesson(index: number) {
    const l = lessons[index];
    update({
      view: "journey",
      lesson: index,
      lab: l.lab,
      geometry: l.geometry ?? session.geometry,
      preset: l.preset ?? session.preset,
      comparisonEnabled: false,
      sampleIndex: 0,
    });
    setAnswer(null);
    setFeedback("");
    setAnswerCorrect(null);
  }
  async function share() {
    clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(location.href);
      setShareFallback(false);
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setShareFallback(true);
    }
  }
  function confirm() {
    if (answer === null) return;
    const correct = answer === current.quiz.answer;
    setAnswerCorrect(correct);
    if (correct) setCompleted(saveProgress([...completed, current.id]));
    setFeedback(current.quiz.explanation);
  }
  function resetProgress() {
    setCompleted(clearProgress());
    setResetPrompt(false);
    setAnswer(null);
    setFeedback("");
    setAnswerCorrect(null);
    resetButton.current?.focus();
  }
  const lab = (
    <>
      {session.lab === "geometry" ? (
        <GeometryLab
          kind={session.geometry}
          size={session.size}
          onKindChange={(geometry) => update({ geometry })}
          onSizeChange={(size) => update({ size })}
          advanced={session.advanced}
        />
      ) : (
        <ThreeBodyLab
          key={`lab-${storyEpoch}-${session.language}`}
          preset={session.preset}
          onPresetChange={(preset) =>
            update({ preset, sampleIndex: 0, comparisonEnabled: false })
          }
          advanced={session.advanced}
          comparisonEnabled={session.comparisonEnabled}
          onComparisonChange={(comparisonEnabled) =>
            update({ comparisonEnabled })
          }
          perturbation={session.perturbation}
          onPerturbationChange={(perturbation) => update({ perturbation })}
          sampleIndex={session.sampleIndex}
          onSampleIndexChange={(sampleIndex) => update({ sampleIndex })}
        />
      )}
    </>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        {t("К содержимому")}
      </a>
      <header className="topbar">
        <div className="language-control">
          <label htmlFor="language">Language / 语言</label>
          <select
            aria-label="Language / 语言"
            id="language"
            value={session.language}
            onChange={(event) =>
              update({ language: event.target.value as Session["language"] })
            }
          >
            <option value="ru">Русский</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </div>
        <a
          className="brand"
          href={"?" + sessionQuery({ ...defaults, language: session.language })}
          onClick={(event) => {
            if (
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            )
              return;
            event.preventDefault();
            update({ ...defaults, language: session.language });
          }}
        >
          <span className="brand-mark">
            <Orbit size={25} />
          </span>
          <span>{t("контур")}</span>
        </a>
        <nav aria-label={t("Основная навигация")}>
          {(
            [
              { id: "systems", name: t("Системы"), icon: Orbit },
              { id: "story", name: t("История"), icon: BookOpen },
              { id: "journey", name: t("Маршрут"), icon: Compass },
              { id: "lab", name: t("Лаборатория"), icon: FlaskConical },
              { id: "library", name: t("Источники"), icon: BookOpen },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-current={session.view === item.id ? "page" : undefined}
              className={session.view === item.id ? "nav-active" : ""}
              onClick={() =>
                item.id === "journey"
                  ? openLesson(session.lesson)
                  : update({ view: item.id })
              }
            >
              <item.icon size={16} />
              {item.name}
            </button>
          ))}
        </nav>
        <button
          className="share-button"
          aria-label={copied ? t("Ссылка скопирована") : t("Поделиться опытом")}
          onClick={share}
        >
          <Link2 size={16} />
          <span>{copied ? t("Скопировано") : t("Поделиться опытом")}</span>
        </button>
      </header>
      {shareFallback && (
        <section className="share-fallback" aria-label={t("Ссылка на опыт")}>
          <p role="status">
            {t(
              "Не удалось скопировать ссылку. Выделите её и скопируйте вручную.",
            )}
          </p>
          <label htmlFor="share-url">{t("Ссылка на опыт")}</label>
          <input
            id="share-url"
            readOnly
            value={location.href}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            onClick={() => {
              (
                document.getElementById("share-url") as HTMLInputElement
              )?.select();
            }}
          >
            {t("Выделить ссылку")}
          </button>
          <button type="button" onClick={() => setShareFallback(false)}>
            {t("Закрыть")}
          </button>
        </section>
      )}
      <main id="main">
        {session.view === "systems" && (
          <section className="systems-page">
            <div className="system-page-heading">
              <h1 ref={pageHeading} tabIndex={-1}>
                {t("Солнечная система и три солнца")}
              </h1>
              <p>
                {t(
                  "Выберите планету, рассмотрите её вблизи и проследите за движением по орбите.",
                )}
              </p>
            </div>
            <Suspense fallback={<p role="status">{t("Загружаем сцену…")}</p>}>
              <SystemScene
                key={`system-${storyEpoch}-${session.language}`}
                system={session.system}
                onSystemChange={(system) => update({ system, systemTime: 0 })}
                time={session.systemTime}
                onTimeChange={(systemTime) => update({ systemTime })}
              />
            </Suspense>
            <div className="system-learning-link">
              <button
                className="text-button"
                onClick={() => update({ view: "story" })}
              >
                {t("История трёх тел")} <ArrowRight size={16} />
              </button>
              <button className="text-button" onClick={() => openLesson(0)}>
                {t("К шести опытам")} <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}
        {session.view === "story" && (
          <section className="story-page">
            <Suspense fallback={<p role="status">{t("Загружаем сцену…")}</p>}>
              <StoryExplorer
                chapter={session.storyChapter}
                onChapterChange={(storyChapter) => update({ storyChapter })}
              />
            </Suspense>
          </section>
        )}
        {session.view === "journey" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <h1>{t("Геометрия и движение")}</h1>
                <p className="hero-description">
                  {t(
                    "Может ли треугольник иметь три прямых угла? Почему три солнца так трудно предсказать? Проверьте сами — в опытах по мотивам трилогии «Задача трёх тел».",
                  )}
                </p>
                <div className="hero-actions">
                  <a
                    href="#experiment"
                    onClick={() => openLesson(0)}
                    className="primary-button"
                  >
                    {t("К первому опыту")}
                    <ArrowDown size={17} />
                  </a>
                  <span className="hero-meta">
                    {t("6 опытов")}
                    <span>·</span> {t("в своём темпе")}
                  </span>
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <svg viewBox="0 0 430 300">
                  <defs>
                    <radialGradient id="globeGlow">
                      <stop stopColor="#4b8980" stopOpacity=".23" />
                      <stop offset="1" stopColor="#4b8980" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="230" cy="146" r="136" fill="url(#globeGlow)" />
                  <circle
                    cx="230"
                    cy="146"
                    r="109"
                    fill="none"
                    stroke="#7cb1a4"
                    strokeOpacity=".3"
                  />
                  <ellipse
                    cx="230"
                    cy="146"
                    rx="109"
                    ry="35"
                    fill="none"
                    stroke="#7cb1a4"
                    strokeOpacity=".32"
                    transform="rotate(-25 230 146)"
                  />
                  <ellipse
                    cx="230"
                    cy="146"
                    rx="45"
                    ry="109"
                    fill="none"
                    stroke="#7cb1a4"
                    strokeOpacity=".32"
                    transform="rotate(-25 230 146)"
                  />
                  <path
                    d="M 152 187 Q 182 89 235 40 Q 301 105 336 169 Q 253 217 152 187"
                    fill="#89cfb811"
                    stroke="#b2ead8"
                    strokeWidth="1.8"
                  />
                  <g fill="#c3f0df">
                    <circle cx="152" cy="187" r="4" />
                    <circle cx="235" cy="40" r="4" />
                    <circle cx="336" cy="169" r="4" />
                  </g>
                  <g fill="#a7b9b8" fontSize="12" fontFamily="monospace">
                    <text x="136" y="211">
                      A
                    </text>
                    <text x="232" y="27">
                      B
                    </text>
                    <text x="346" y="173">
                      C
                    </text>
                    <text x="281" y="265">
                      Σα &gt; 180°
                    </text>
                    <text x="53" y="65">
                      K &gt; 0
                    </text>
                  </g>
                  <path
                    d="M 66 78 H 129"
                    stroke="#659586"
                    strokeOpacity=".45"
                  />
                </svg>
                <span className="art-caption">
                  {t("На сфере правила знакомого треугольника меняются.")}
                </span>
              </div>
            </section>
            <div className="section-heading">
              <div>
                <h2>{t("Шесть опытов")}</h2>
              </div>
              <span className="progress-label">
                <CheckCircle2 size={16} />
                {locale === "zh-CN"
                  ? `已核对 ${completed.length} / ${lessons.length}`
                  : `Проверено: ${completed.length} из ${lessons.length}`}
              </span>
            </div>
            <div className="progress-actions">
              <button
                type="button"
                className="text-button"
                ref={resetButton}
                onClick={() => setResetPrompt(true)}
              >
                {t("Сбросить учебный прогресс")}
              </button>
              {resetPrompt && (
                <div
                  role="group"
                  aria-label={t("Подтверждение сброса прогресса")}
                >
                  <p>
                    {t(
                      "Удалить отметки о проверенных ответах в этом браузере?",
                    )}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={resetProgress}
                  >
                    {t("Удалить отметки")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setResetPrompt(false);
                      resetButton.current?.focus();
                    }}
                  >
                    {t("Отмена")}
                  </button>
                </div>
              )}
            </div>
            <section className="journey-layout" id="experiment">
              <aside className="journey-sidebar">
                <p className="sidebar-label">{t("ВАШИ ЭКСПЕРИМЕНТЫ")}</p>
                <ol className="lesson-list">
                  {lessons.map((l, index) => (
                    <li key={l.id}>
                      <button
                        className={
                          session.lesson === index ? "lesson-active" : ""
                        }
                        onClick={() => openLesson(index)}
                        aria-current={
                          session.lesson === index ? "step" : undefined
                        }
                      >
                        <span className="lesson-number">
                          {completed.includes(l.id) ? (
                            <Check size={15} />
                          ) : (
                            l.number
                          )}
                        </span>
                        <span>
                          <strong>{l.title}</strong>
                          <small>{l.book}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="sidebar-note">
                  <GraduationCap size={20} />
                  <p>
                    {t("Начните с наблюдения. Формулы можно открыть позже.")}
                  </p>
                </div>
              </aside>
              <article className="lesson-content">
                <div className="lesson-intro">
                  <div className="lesson-kicker">
                    <span>
                      {t("ОПЫТ")} {current.number}
                    </span>
                    <span>
                      {current.lab === "geometry"
                        ? t("ГЕОМЕТРИЯ")
                        : t("ДИНАМИКА")}
                    </span>
                  </div>
                  <h2 ref={lessonHeading} tabIndex={-1}>
                    {current.question}
                  </h2>
                  <p>{current.scienceContext}</p>
                  <StoryDisclosure
                    key={`story-${storyEpoch}-${session.lesson}-${session.view}-${locale}`}
                  >
                    <p>{current.context}</p>
                    {current.source && (
                      <a
                        className="context-source"
                        href={current.source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {current.source.title}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </StoryDisclosure>
                  {current.hypothesis && (
                    <p className="hypothesis">
                      <strong>{t("Перед опытом:")}</strong> {current.hypothesis}
                    </p>
                  )}
                  <div className="task-strip">
                    <span className="task-icon">
                      <Compass size={18} />
                    </span>
                    <p>
                      <strong>{t("Попробуйте")}</strong>
                      {current.experiment}
                    </p>
                  </div>
                </div>
                <div className="lab-header">
                  <span>
                    <FlaskConical size={16} /> {t("ИНТЕРАКТИВНЫЙ ОПЫТ")}
                  </span>
                  <button
                    className="level-button"
                    aria-pressed={session.advanced}
                    onClick={() => update({ advanced: !session.advanced })}
                  >
                    <Layers3 size={15} />
                    {session.advanced
                      ? t("Скрыть формулы")
                      : t("Показать формулы")}
                    <span
                      className={"switch " + (session.advanced ? "on" : "")}
                    />
                  </button>
                </div>
                {lab}
                {current.id === "boundary" && <DimensionDemo />}
                <div className="observation">
                  <span className="eyebrow dark">{t("ЧТО ЗДЕСЬ ВАЖНО")}</span>
                  <p>{current.observe}</p>
                  <small>{current.limit}</small>
                </div>
                <fieldset className="quiz">
                  <legend>{current.quiz.question}</legend>
                  {current.quiz.options.map((option, index) => (
                    <label
                      key={option}
                      className={
                        answer === index ? "answer selected" : "answer"
                      }
                    >
                      <input
                        type="radio"
                        name="answer"
                        checked={answer === index}
                        onChange={() => {
                          setAnswer(index);
                          setFeedback("");
                          setAnswerCorrect(null);
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  <div className="quiz-actions">
                    <button
                      className="primary-button"
                      onClick={confirm}
                      disabled={answer === null}
                    >
                      {t("Проверить вывод")}
                      <Check size={16} />
                    </button>
                    {completed.includes(current.id) && (
                      <span className="success">
                        <CheckCircle2 size={16} />
                        {t("Ответ проверен")}
                      </span>
                    )}
                  </div>
                  <div
                    className={
                      answerCorrect === false
                        ? "feedback needs-review"
                        : "feedback"
                    }
                    role="status"
                  >
                    {answerCorrect !== null && (
                      <strong>
                        {answerCorrect
                          ? t("Верно.")
                          : t(
                              "Пока не совсем. Сверьте вывод с опытом и попробуйте снова.",
                            )}
                      </strong>
                    )}
                    {feedback && <p>{feedback}</p>}
                  </div>
                </fieldset>
                <div className="lesson-footer">
                  <button
                    className="text-button"
                    disabled={session.lesson === 0}
                    onClick={() => openLesson(session.lesson - 1)}
                  >
                    <ArrowLeft size={16} />
                    {t("Предыдущий")}
                  </button>
                  <button
                    className="text-button"
                    disabled={session.lesson === lessons.length - 1}
                    onClick={() => openLesson(session.lesson + 1)}
                  >
                    {t("Следующий опыт")}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            </section>
          </>
        )}
        {session.view === "lab" && (
          <section className="standalone">
            <div className="page-heading">
              <p className="eyebrow dark">{t("СВОБОДНОЕ ИССЛЕДОВАНИЕ")}</p>
              <h1 ref={pageHeading} tabIndex={-1}>
                {t("Лаборатория")}
              </h1>
            </div>
            <div className="standalone-toolbar">
              <div className="segmented" aria-label={t("Лаборатория")}>
                <button
                  aria-pressed={session.lab === "geometry"}
                  onClick={() => update({ lab: "geometry" })}
                >
                  {t("Геометрия")}
                </button>
                <button
                  aria-pressed={session.lab === "threebody"}
                  onClick={() => update({ lab: "threebody" })}
                >
                  {t("Три тела")}
                </button>
              </div>
              <button
                className="level-button"
                aria-pressed={session.advanced}
                onClick={() => update({ advanced: !session.advanced })}
              >
                {t("Формулы и метод")}
                <span className={"switch " + (session.advanced ? "on" : "")} />
              </button>
              <button
                className="text-button"
                onClick={() =>
                  update({
                    size: defaults.size,
                    geometry: defaults.geometry,
                    preset: defaults.preset,
                    comparisonEnabled: false,
                    sampleIndex: 0,
                  })
                }
              >
                <RotateCcw size={15} />
                {t("Сбросить")}
              </button>
            </div>
            {lab}
          </section>
        )}
        {session.view === "library" && (
          <section className="standalone library">
            <div className="page-heading">
              <h1 ref={pageHeading} tabIndex={-1}>
                {t("Модели и источники")}
              </h1>
              <p>
                {t(
                  "Уравнения, допущения и материалы для самостоятельного изучения.",
                )}
              </p>
            </div>
            <div className="principle-grid">
              <article>
                <span>{t("01 / ГЕОМЕТРИЯ")}</span>
                <h2>{t("Геометрия поверхности")}</h2>
                <p>
                  {t(
                    "Сфера и диск Пуанкаре описывают двумерные геометрии постоянной кривизны. Мы измеряем внутренние углы и длины. Это не модель пространства-времени и не реализация метрики FLRW.",
                  )}
                </p>
              </article>
              <article>
                <span>{t("02 / ДИНАМИКА")}</span>
                <h2>{t("Движение тел")}</h2>
                <p>
                  {t(
                    "Точечные массы, ньютоновская гравитация и безразмерные единицы. Библиотека ODEX подбирает шаг по заданной точности. При тесном сближении или большой ошибке расчёт останавливается.",
                  )}
                </p>
              </article>
              <article>
                <span>{t("03 / ХУДОЖЕСТВЕННЫЙ МИР")}</span>
                <h2>{t("Связь с книгами")}</h2>
                <p>
                  {t(
                    "Задача трёх тел и геометрия изучаются как самостоятельные научные модели. Литературные пояснения доступны отдельно по вашему выбору.",
                  )}
                </p>
              </article>
            </div>
            <h2 className="source-heading">
              {t("Источники и дальнейшее чтение")}
            </h2>
            <div className="source-list">
              {sources
                .filter((s) => !s.literary)
                .map((s, i) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    <span className="source-number">0{i + 1}</span>
                    <span>
                      <small>{s.organization}</small>
                      <h3>{s.title}</h3>
                      <p>{s.note}</p>
                    </span>
                    <ExternalLink size={18} />
                  </a>
                ))}
            </div>
            <StoryDisclosure key={`library-story-${storyEpoch}-${locale}`}>
              {sources
                .filter((s) => s.literary)
                .map((source) => (
                  <p key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} ↗
                    </a>
                    <br />
                    {source.note}
                  </p>
                ))}
            </StoryDisclosure>
            <div className="method-note">
              <BookOpen size={22} />
              <div>
                <h3>{t("Код и формулы")}</h3>
                <p>
                  {t(
                    "Код, тесты и описание моделей доступны в репозитории. Ссылка на опыт сохраняет модель и параметры.",
                  )}
                </p>
                <a
                  href="https://github.com/mmkolpakov/Geometry-System"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Открыть репозиторий ↗")}
                </a>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Orbit size={18} />
          {t("контур")}
        </span>
        <span>{t("Геометрия и орбиты · Лю Цысинь")}</span>
        <a
          href="https://github.com/mmkolpakov/Geometry-System"
          target="_blank"
          rel="noreferrer"
        >
          {t("Код и метод")}
          <ExternalLink size={13} />
        </a>
      </footer>
    </>
  );
}
