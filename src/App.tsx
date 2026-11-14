import { useEffect, useState } from "react";
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
import { lessons } from "./content/curriculum";
import { sources } from "./content/sources";
import {
  defaults,
  readProgress,
  readSession,
  saveProgress,
  sessionQuery,
  type Session,
} from "./state/session";

export default function App() {
  const [session, setSession] = useState(() => readSession(location.search));
  const [completed, setCompleted] = useState(readProgress);
  const [answer, setAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const current = lessons[Math.min(session.lesson, lessons.length - 1)];
  const update = (patch: Partial<Session>) =>
    setSession((s) => ({ ...s, ...patch }));
  useEffect(() => {
    history.replaceState(null, "", "?" + sessionQuery(session));
  }, [session]);
  useEffect(() => {
    const listener = () => setSession(readSession(location.search));
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    setAnswer(null);
    setFeedback("");
  }, [session.lesson]);
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
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback(
        "Ссылка находится в адресной строке браузера. Её можно скопировать вручную.",
      );
    }
  }
  function confirm() {
    if (answer === null) return;
    if (answer === current.quiz.answer) {
      const next = [...new Set([...completed, current.id])];
      setCompleted(next);
      saveProgress(next);
    }
    setFeedback(current.quiz.explanation);
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
        К содержимому
      </a>
      <header className="topbar">
        <a className="brand" href="?">
          <span className="brand-mark">
            <Orbit size={25} />
          </span>
          <span>
            контур
            <span className="brand-caption">ЛАБОРАТОРИЯ ВОЗМОЖНЫХ МИРОВ</span>
          </span>
        </a>
        <nav aria-label="Основная навигация">
          {(
            [
              { id: "journey", name: "Маршрут", icon: Compass },
              { id: "lab", name: "Лаборатория", icon: FlaskConical },
              { id: "library", name: "Основания", icon: BookOpen },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-current={session.view === item.id ? "page" : undefined}
              className={session.view === item.id ? "nav-active" : ""}
              onClick={() => item.id === "journey" ? openLesson(session.lesson) : update({ view: item.id })}
            >
              <item.icon size={16} />
              {item.name}
            </button>
          ))}
        </nav>
        <button
          className="share-button"
          aria-label={copied ? "Ссылка скопирована" : "Поделиться опытом"}
          onClick={share}
        >
          <Link2 size={16} />
          <span>{copied ? "Скопировано" : "Поделиться опытом"}</span>
        </button>
      </header>
      <main id="main">
        {session.view === "journey" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span /> НАУКА ПО ТУ СТОРОНУ СЮЖЕТА
                </p>
                <h1>
                  Привычный мир.
                  <br />
                  <em>Непривычные правила.</em>
                </h1>
                <p className="hero-description">
                  Может ли треугольник иметь три прямых угла? Почему три солнца
                  так трудно предсказать? Проверьте сами — в опытах по мотивам
                  трилогии «Задача трёх тел».
                </p>
                <div className="hero-actions">
                  <a
                    href="#experiment"
                    onClick={() => openLesson(0)}
                    className="primary-button"
                  >
                    К первому опыту <ArrowDown size={17} />
                  </a>
                  <span className="hero-meta">
                    6 опытов <span>·</span> в своём темпе
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
                  На сфере правила знакомого треугольника меняются.
                </span>
              </div>
            </section>
            <div className="section-heading">
              <div>
                <p className="eyebrow dark">ИССЛЕДОВАТЕЛЬСКИЙ МАРШРУТ</p>
                <h2>От вопроса — к собственному открытию</h2>
              </div>
              <span className="progress-label">
                <CheckCircle2 size={16} />
                {completed.length} из {lessons.length} пройдено
              </span>
            </div>
            <section className="journey-layout" id="experiment">
              <aside className="journey-sidebar">
                <p className="sidebar-label">ВАШИ ЭКСПЕРИМЕНТЫ</p>
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
                    Здесь нет нужного уровня подготовки. Начните с наблюдения, а
                    формулы откройте, когда захотите.
                  </p>
                </div>
              </aside>
              <article className="lesson-content">
                <div className="lesson-intro">
                  <div className="lesson-kicker">
                    <span>ОПЫТ {current.number}</span>
                    <span>
                      {current.lab === "geometry" ? "ГЕОМЕТРИЯ" : "ДИНАМИКА"}
                    </span>
                  </div>
                  <h2>{current.question}</h2>
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
                  {current.hypothesis && (
                    <p className="hypothesis">
                      <strong>Перед опытом:</strong> {current.hypothesis}
                    </p>
                  )}
                  <div className="task-strip">
                    <span className="task-icon">
                      <Compass size={18} />
                    </span>
                    <p>
                      <strong>Попробуйте</strong>
                      {current.experiment}
                    </p>
                  </div>
                </div>
                <div className="lab-header">
                  <span>
                    <FlaskConical size={16} /> ИНТЕРАКТИВНЫЙ ОПЫТ
                  </span>
                  <button
                    className="level-button"
                    aria-pressed={session.advanced}
                    onClick={() => update({ advanced: !session.advanced })}
                  >
                    <Layers3 size={15} />
                    {session.advanced ? "С формулами" : "Без формул"}
                    <span
                      className={"switch " + (session.advanced ? "on" : "")}
                    />
                  </button>
                </div>
                {lab}
                {current.id === "boundary" && <DimensionDemo />}
                <div className="observation">
                  <span className="eyebrow dark">ЧТО ЗДЕСЬ ВАЖНО</span>
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
                      Проверить вывод <Check size={16} />
                    </button>
                    {completed.includes(current.id) && (
                      <span className="success">
                        <CheckCircle2 size={16} />
                        Опыт пройден
                      </span>
                    )}
                  </div>
                  <p className="feedback" role="status">
                    {feedback}
                  </p>
                </fieldset>
                <div className="lesson-footer">
                  <button
                    className="text-button"
                    disabled={session.lesson === 0}
                    onClick={() => openLesson(session.lesson - 1)}
                  >
                    <ArrowLeft size={16} />
                    Предыдущий
                  </button>
                  <button
                    className="text-button"
                    disabled={session.lesson === lessons.length - 1}
                    onClick={() => openLesson(session.lesson + 1)}
                  >
                    Следующий опыт
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
              <p className="eyebrow dark">СВОБОДНОЕ ИССЛЕДОВАНИЕ</p>
              <h1>Лаборатория</h1>
              <p>Один параметр. Одно изменение. Наблюдаемый результат.</p>
            </div>
            <div className="standalone-toolbar">
              <div className="segmented" aria-label="Лаборатория">
                <button
                  aria-pressed={session.lab === "geometry"}
                  onClick={() => update({ lab: "geometry" })}
                >
                  Геометрия
                </button>
                <button
                  aria-pressed={session.lab === "threebody"}
                  onClick={() => update({ lab: "threebody" })}
                >
                  Три тела
                </button>
              </div>
              <button
                className="level-button"
                aria-pressed={session.advanced}
                onClick={() => update({ advanced: !session.advanced })}
              >
                Формулы и метод
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
                Сбросить
              </button>
            </div>
            {lab}
          </section>
        )}
        {session.view === "library" && (
          <section className="standalone library">
            <div className="page-heading">
              <p className="eyebrow dark">ПРОВЕРЯЕМЫЕ ОСНОВАНИЯ</p>
              <h1>Где заканчивается модель</h1>
              <p>
                Вопросы взяты из художественного мира. Ответы нужно проверять за
                его пределами.
              </p>
            </div>
            <div className="principle-grid">
              <article>
                <span>01 / ГЕОМЕТРИЯ</span>
                <h2>Поверхность — не Вселенная</h2>
                <p>
                  Сфера и диск Пуанкаре описывают двумерные геометрии постоянной
                  кривизны. Мы измеряем внутренние углы и длины. Это не модель
                  пространства-времени и не реализация метрики FLRW.
                </p>
              </article>
              <article>
                <span>02 / ДИНАМИКА</span>
                <h2>Расчёт — не пророчество</h2>
                <p>
                  Точечные массы, ньютоновская гравитация и безразмерные
                  единицы. Библиотека ODEX подбирает шаг по заданной точности.
                  При тесном сближении или большой ошибке расчёт
                  останавливается.
                </p>
              </article>
              <article>
                <span>03 / ХУДОЖЕСТВЕННЫЙ МИР</span>
                <h2>Метафора — не доказательство</h2>
                <p>
                  Три солнца дают повод изучить динамику. Сюжеты о размерностях
                  — геометрию. Опыты не воспроизводят технологии, цивилизации
                  или космологию трилогии.
                </p>
              </article>
            </div>
            <h2 className="source-heading">Источники и дальнейшее чтение</h2>
            <div className="source-list">
              {sources.map((s, i) => (
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
            <div className="method-note">
              <BookOpen size={22} />
              <div>
                <h3>Открытый метод</h3>
                <p>
                  Исходники, тесты математических моделей и исследовательские
                  заметки доступны в репозитории. Для воспроизведения опыта
                  достаточно ссылки: она сохраняет выбранную модель и параметры,
                  но не личный прогресс.
                </p>
                <a
                  href="https://github.com/mmkolpakov/Geometry-System"
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть репозиторий ↗
                </a>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Orbit size={18} />
          контур
        </span>
        <span>
          Независимая образовательная лаборатория · по мотивам трилогии Лю
          Цысиня
        </span>
        <a
          href="https://github.com/mmkolpakov/Geometry-System"
          target="_blank"
          rel="noreferrer"
        >
          Код и метод <ExternalLink size={13} />
        </a>
      </footer>
    </>
  );
}
