import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useLocale } from "../i18n";
import { storyCases } from "../content/story";
import { StoryScene } from "./StoryScene";

const copy = {
  ru: {
    warning: "История трилогии",
    warningText: "Далее — ключевые события и финалы всех трёх книг.",
    open: "Открыть историю",
    previous: "Предыдущий эпизод",
    next: "Следующий эпизод",
    play: "Воспроизвести",
    pause: "Пауза",
    replay: "В начало эпизода",
    back: "Предыдущий шаг",
    forward: "Следующий шаг",
    stage: "Шаг сцены",
    sources: "Книга и источник",
    science: "Наука и вымысел",
    hide: "Закрыть историю",
    timeline: "Эпизоды трилогии",
    books: ["Задача трёх тел", "Тёмный лес", "Вечная жизнь"],
    counter: "из",
  },
  "zh-CN": {
    warning: "三部曲剧情，包含剧透",
    warningText:
      "这里会揭示三本书的关键事件与结局。无需打开故事，也可以体验科学实验。",
    open: "打开故事",
    previous: "上一幕",
    next: "下一幕",
    play: "播放",
    pause: "暂停",
    replay: "从头开始",
    back: "上一步",
    forward: "下一步",
    stage: "场景步骤",
    sources: "书籍与来源",
    science: "科学问题",
    hide: "关闭故事",
    timeline: "三部曲情节",
    books: ["三体", "黑暗森林", "死神永生"],
    counter: "/",
  },
};
export function StoryExplorer({
  chapter,
  onChapterChange,
}: {
  chapter: number;
  onChapterChange: (chapter: number) => void;
}) {
  const { locale } = useLocale(),
    c = copy[locale];
  const [revealed, setRevealed] = useState(false),
    [phase, setPhase] = useState(0),
    [playing, setPlaying] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    currentButton = useRef<HTMLButtonElement>(null),
    openButton = useRef<HTMLButtonElement>(null),
    returnToGate = useRef(false);
  const index = Math.max(0, Math.min(storyCases.length - 1, chapter)),
    current = storyCases[index];
  useEffect(() => {
    setPlaying(false);
    setPhase(0);
    if (!revealed && returnToGate.current) {
      openButton.current?.focus();
      returnToGate.current = false;
    }
    if (revealed) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
      const button = currentButton.current;
      if (button?.parentElement)
        button.parentElement.scrollTo({
          left: button.offsetLeft - button.parentElement.offsetLeft - 8,
          behavior: "instant",
        });
    }
  }, [index, revealed]);
  useEffect(() => {
    if (!playing) return;
    if (phase === 2) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setPhase((value) => value + 1), 1700);
    return () => clearTimeout(timer);
  }, [playing, phase]);
  const selectPhase = (value: number) => {
    setPlaying(false);
    setPhase(value);
  };
  if (!revealed)
    return (
      <section className="story-intro">
        <h1>{c.warning}</h1>
        <p>{c.warningText}</p>
        <button
          type="button"
          className="primary-button"
          ref={openButton}
          onClick={() => setRevealed(true)}
        >
          {c.open}
          <ArrowRight size={17} />
        </button>
      </section>
    );
  return (
    <section className="story-explorer">
      <header className="story-heading">
        <div>
          <span className="story-book">
            {c.books[current.book - 1]} · {current.era[locale]}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {current.title[locale]}
          </h1>
          <p>
            {index + 1} {c.counter} {storyCases.length}
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setPlaying(false);
            returnToGate.current = true;
            setRevealed(false);
          }}
        >
          {c.hide}
        </button>
      </header>
      <div className="story-layout">
        <div className="story-visual">
          <StoryScene event={current} phase={phase} />
          <div className="story-controls">
            <button
              type="button"
              aria-pressed={playing}
              onClick={() => {
                if (phase === 2) setPhase(0);
                setPlaying((value) => !value);
              }}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              <span>{playing ? c.pause : c.play}</span>
            </button>
            <button
              type="button"
              aria-label={c.replay}
              onClick={() => selectPhase(0)}
            >
              <RotateCcw size={17} />
            </button>
            <label className="story-phase-label">
              <span className="sr-only">{c.stage}</span>
              <input
                aria-label={c.stage}
                aria-valuetext={current.steps[phase].title[locale]}
                type="range"
                min="0"
                max="2"
                step="1"
                value={phase}
                onChange={(event) => selectPhase(Number(event.target.value))}
              />
            </label>
            <output>{phase + 1} / 3</output>
          </div>
          <div className="story-beats" role="group" aria-label={c.stage}>
            {current.steps.map((step, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={phase === i}
                onClick={() => selectPhase(i)}
              >
                <span>{i + 1}</span>
                {step.title[locale]}
              </button>
            ))}
          </div>
        </div>
        <article className="story-copy">
          <p>{current.summary[locale]}</p>
          <div className="story-step-copy" aria-live="polite">
            <h2>{current.steps[phase].title[locale]}</h2>
            <p>{current.steps[phase].detail[locale]}</p>
          </div>
          <div className="story-step-navigation">
            <button
              type="button"
              aria-label={c.back}
              disabled={phase === 0}
              onClick={() => selectPhase(phase - 1)}
            >
              <SkipBack size={17} />
            </button>
            <button
              type="button"
              aria-label={c.forward}
              disabled={phase === 2}
              onClick={() => selectPhase(phase + 1)}
            >
              <SkipForward size={17} />
            </button>
          </div>
          <p className="story-question">{current.question[locale]}</p>
          <details>
            <summary>{c.science}</summary>
            <p>{current.science[locale]}</p>
          </details>
          <details>
            <summary>{c.sources}</summary>
            <p>
              {c.books[current.book - 1]} · {current.era[locale]}
            </p>
            <a href={current.source.url} target="_blank" rel="noreferrer">
              {current.source.title[locale]} ↗
            </a>
            <p>{current.source.note[locale]}</p>
          </details>
        </article>
      </div>
      <nav className="story-navigation" aria-label={c.timeline}>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onChapterChange(index - 1)}
        >
          <ArrowLeft size={17} />
          {c.previous}
        </button>
        <button
          type="button"
          disabled={index === storyCases.length - 1}
          onClick={() => onChapterChange(index + 1)}
        >
          {c.next}
          <ArrowRight size={17} />
        </button>
      </nav>
      <div className="story-timeline" role="group" aria-label={c.timeline}>
        {storyCases.map((event, i) => (
          <button
            key={event.id}
            ref={i === index ? currentButton : undefined}
            type="button"
            aria-current={i === index ? "step" : undefined}
            onClick={() => onChapterChange(i)}
          >
            <span>
              {String(i + 1).padStart(2, "0")} · {c.books[event.book - 1]}
            </span>
            {event.title[locale]}
          </button>
        ))}
      </div>
    </section>
  );
}
