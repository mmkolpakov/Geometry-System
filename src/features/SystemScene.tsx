import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useLocale } from "../i18n";
import { observe } from "../domain/observer";
import { useSystemRenderer, type SystemCameraView } from "./useSystemRenderer";
import {
  SYSTEM_DURATION,
  systemSnapshot,
  solarDate,
  type SystemBody,
  type SystemId,
} from "../domain/systems";

type Props = {
  system: SystemId;
  onSystemChange: (system: SystemId) => void;
  time: number;
  onTimeChange: (time: number) => void;
};
const copy = {
  ru: {
    solar: "Солнечная система",
    triple: "Три солнца",
    view: "Звёздные системы",
    choose: "Выбрать объект",
    play: "Пуск",
    pause: "Пауза",
    step: "На шаг вперёд",
    reset: "В начало",
    top: "Сверху",
    tilted: "Под углом",
    time: "Время",
    years: "г.",
    units: "ед.",
    speed: "Скорость",
    yearSecond: "г./с",
    unitSecond: "ед./с",
    radius: "Радиус",
    orbit: "Большая полуось",
    period: "Период обращения",
    distance: "Расстояние от центра масс",
    star: "Звезда",
    planet: "Планета",
    au: "а. е.",
    km: "км",
    model: "Как устроен расчёт",
    scale: "Положения на выбранную дату · обзорный масштаб",
    tripleScale: "Размеры тел условны · расстояния в единицах модели",
    solarNote:
      "Положения рассчитывает Astronomy Engine. Обзор сжимает расстояния и увеличивает тела; масштаб 1:1 сохраняет соотношение размеров и расстояний. Дата отсчитывается от 1 января 2000 года.",
    tripleNote:
      "Три равные звезды обращаются в конфигурации Лагранжа. Пробная планета движется в их суммарном поле и не влияет на звёзды. Время в единицах модели, не годах. Интервал 40 единиц не определяет длительную устойчивость или климат; внешность тел условна.",
    camera: "Перетащите для поворота · прокрутите для приближения",
    fallback:
      "3D недоступно в этом браузере. Объекты и их положение доступны ниже.",
    stopped: "Расчёт остановлен",
    source: "Данные и метод",
    complete: "Конец интервала",
    running: "Воспроизведение",
    paused: "На паузе",
  },
  "zh-CN": {
    solar: "太阳系",
    triple: "三颗太阳",
    view: "恒星系统概览",
    choose: "选择天体",
    play: "开始",
    pause: "暂停",
    step: "单步",
    reset: "重置",
    top: "俯视",
    tilted: "斜视",
    time: "时间",
    years: "年",
    units: "单位",
    speed: "速度",
    yearSecond: "年/秒",
    unitSecond: "单位/秒",
    radius: "平均半径",
    orbit: "半长轴",
    period: "公转周期",
    distance: "距质心",
    star: "恒星",
    planet: "行星",
    au: "天文单位",
    km: "千米",
    model: "关于模型",
    scale: "所选日期的位置 · 概览比例",
    tripleScale: "天体大小为示意 · 距离采用模型单位",
    solarNote:
      "位置由 Astronomy Engine 计算。概览压缩距离并放大天体；1:1 保持尺寸与距离的比例。日期从 2000 年 1 月 1 日起计算。",
    tripleNote:
      "三颗等质量恒星按拉格朗日构型运行。测试行星受三颗恒星的合引力作用，不影响恒星。时间采用模型单位，不是年。40 个单位的计算不能确定长期稳定性或气候；天体外观为示意。",
    camera: "拖动旋转 · 滚动缩放",
    fallback: "此浏览器无法显示 3D。下方仍可查看天体及其位置。",
    stopped: "计算已停止",
    source: "数据与方法",
    complete: "时间区间结束",
    running: "播放中",
    paused: "已暂停",
  },
};
const namesZh: Record<string, string> = {
  sun: "太阳",
  mercury: "水星",
  venus: "金星",
  earth: "地球",
  mars: "火星",
  jupiter: "木星",
  saturn: "土星",
  uranus: "天王星",
  neptune: "海王星",
  "star-a": "恒星 A",
  "star-b": "恒星 B",
  "star-c": "恒星 C",
  "test-planet": "测试行星",
};
export function SystemScene({
  system,
  onSystemChange,
  time,
  onTimeChange,
}: Props) {
  const { locale, number } = useLocale(),
    c = copy[locale];
  const name = (body: SystemBody) =>
    locale === "zh-CN" ? namesZh[body.id] : body.name;
  const [selectedId, setSelectedId] = useState(
    system === "solar" ? "earth" : "test-planet",
  );
  const [physical, setPhysical] = useState(false),
    [focused, setFocused] = useState(false),
    [curvature, setCurvature] = useState(false);
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [cameraView, setCameraView] = useState<SystemCameraView>("tilted"),
    [unavailable, setUnavailable] = useState(false);
  const host = useRef<HTMLDivElement>(null),
    label = useRef<HTMLDivElement>(null);
  const snapshot = useMemo(() => systemSnapshot(system, time), [system, time]);
  const live = useRef({
    time,
    snapshot,
    speed,
    selectedId,
    focused,
    curvature,
    onTimeChange,
  });
  live.current = {
    time,
    snapshot,
    speed,
    selectedId,
    focused,
    curvature,
    onTimeChange,
  };
  const canvasApi = useSystemRenderer({
    system,
    physical,
    host,
    label,
    live,
    setSelectedId,
    setUnavailable,
    setPlaying,
  });
  const uid = useId();
  const selected =
    snapshot.bodies.find((body) => body.id === selectedId) ??
    snapshot.bodies.find(
      (body) => body.id === (system === "solar" ? "earth" : "test-planet"),
    )!;
  const duration = SYSTEM_DURATION[system],
    unit = system === "solar" ? c.years : c.units;
  const planetView =
    system === "triple" && selected.kind === "planet"
      ? observe(
          snapshot.bodies
            .filter((body) => body.kind === "star")
            .map((body) => ({
              mass: 1,
              position: body.position,
              velocity: { x: 0, y: 0 },
            })),
          selected.position,
        )
      : null;

  useEffect(() => {
    setSelectedId(system === "solar" ? "earth" : "test-planet");
    setPlaying(false);
    setSpeed(1);
    setCameraView("tilted");
    setFocused(false);
    setPhysical(false);
  }, [system]);
  useEffect(() => {
    canvasApi.current?.camera(cameraView);
  }, [cameraView]);
  useEffect(() => {
    if (!playing) return;
    let previous: number | undefined,
      frame = 0,
      elapsed = time;
    const tick = (now: number) => {
      if (previous !== undefined)
        elapsed += Math.min((now - previous) / 1000, 0.1) * live.current.speed;
      previous = now;
      const next = systemSnapshot(system, Math.min(duration, elapsed));
      if (
        Math.abs(next.time - live.current.time) >= 0.04 ||
        next.time === duration
      ) {
        live.current.onTimeChange(next.time);
      }
      if (next.time >= duration || (next.halted && next.time < elapsed)) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, system, duration]);

  const seek = (value: number) => {
    setPlaying(false);
    onTimeChange(value);
  };
  return (
    <section className="system-explorer" aria-label={c.view}>
      <div className="system-toolbar">
        <div className="segmented" role="group" aria-label={c.view}>
          {(["solar", "triple"] as const).map((id) => (
            <button
              key={id}
              aria-pressed={system === id}
              onClick={() => {
                setPlaying(false);
                onSystemChange(id);
              }}
            >
              {c[id]}
            </button>
          ))}
        </div>
        <div
          className="system-camera"
          role="group"
          aria-label={locale === "ru" ? "Камера" : "视角"}
        >
          <button
            aria-pressed={cameraView === "tilted"}
            onClick={() => {
              setFocused(false);
              setCameraView("tilted");
              canvasApi.current?.camera("tilted");
            }}
          >
            {c.tilted}
          </button>
          <button
            aria-pressed={cameraView === "top"}
            onClick={() => {
              setFocused(false);
              setCameraView("top");
              canvasApi.current?.camera("top");
            }}
          >
            {c.top}
          </button>
        </div>
      </div>
      <div className="system-view-options">
        {system === "solar" && (
          <button
            aria-pressed={physical}
            onClick={() => {
              setPhysical((value) => !value);
              setFocused(false);
            }}
          >
            {physical
              ? locale === "ru"
                ? "Единый масштаб"
                : "1:1 比例"
              : locale === "ru"
                ? "Масштаб для обзора"
                : "概览比例"}
          </button>
        )}
        <button
          aria-pressed={focused}
          onClick={() => setFocused((value) => !value)}
        >
          {locale === "ru" ? "Крупный план" : "跟随天体"}
        </button>
        <button
          aria-pressed={curvature}
          onClick={() => setCurvature((value) => !value)}
        >
          {locale === "ru" ? "Показать поле тяготения" : "引力网格"}
        </button>
        {system === "solar" && (
          <time dateTime={solarDate(time).toISOString()}>
            {new Intl.DateTimeFormat(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            }).format(solarDate(time))}
          </time>
        )}
      </div>
      {curvature && (
        <p className="system-gravity-note">
          {locale === "ru"
            ? "Схема гравитационной ямы. Глубина условна."
            : "引力势示意图，深度为示意值。"}
        </p>
      )}
      <div className="system-layout">
        <div className="system-stage" ref={host} data-testid="system-canvas">
          <div className="system-stage-label" ref={label}>
            {name(selected)}
          </div>
          <div className="system-stage-caption">
            <span>{c[system]}</span>
            <small>{c.camera}</small>
          </div>
          {unavailable && (
            <p className="system-fallback" role="status">
              {c.fallback}
            </p>
          )}
        </div>
        <aside className="system-details">
          <span className="system-object-kind">
            {selected.kind === "star" ? c.star : c.planet}
          </span>
          <h2 aria-live="polite">{name(selected)}</h2>
          <span
            className="system-object-swatch"
            style={{ background: selected.color }}
          />
          <dl>
            {selected.radiusKm && (
              <>
                <dt>{c.radius}</dt>
                <dd>
                  {number(selected.radiusKm, 0)} {c.km}
                </dd>
              </>
            )}
            {selected.semimajorAu && (
              <>
                <dt>{c.orbit}</dt>
                <dd>
                  {number(selected.semimajorAu, 2)} {c.au}
                </dd>
              </>
            )}
            {selected.periodYears && (
              <>
                <dt>{c.period}</dt>
                <dd>
                  {number(selected.periodYears, 2)} {c.years}
                </dd>
              </>
            )}
            <dt>
              {system === "solar"
                ? locale === "ru"
                  ? "От Солнца"
                  : "距太阳"
                : c.distance}
            </dt>
            <dd data-testid="system-distance">
              {number(
                Math.hypot(
                  selected.position.x,
                  selected.position.y,
                  selected.position.z ?? 0,
                ),
                2,
              )}{" "}
              {system === "solar" ? c.au : c.units}
            </dd>
            {planetView && (
              <>
                <dt>
                  {locale === "ru" ? "До звёзд A · B · C" : "距恒星 A · B · C"}
                </dt>
                <dd>
                  {planetView.stars
                    .map((star) => number(star.distance, 2))
                    .join(" · ")}{" "}
                  {c.units}
                </dd>
                <dt>{locale === "ru" ? "Суммарный поток" : "总辐照度"}</dt>
                <dd>
                  {number(planetView.totalFlux, 3)} <small>Σ 1/r²</small>
                </dd>
              </>
            )}
          </dl>
          <p className="system-scale">
            {system === "solar"
              ? physical
                ? locale === "ru"
                  ? "Единый масштаб размеров и расстояний"
                  : "尺寸与距离使用统一比例"
                : c.scale
              : c.tripleScale}
          </p>
        </aside>
      </div>
      <div className="system-body-list" role="group" aria-label={c.choose}>
        {snapshot.bodies.map((body) => (
          <button
            key={body.id}
            aria-pressed={selected.id === body.id}
            onClick={() => setSelectedId(body.id)}
          >
            <span style={{ background: body.color }} />
            {name(body)}
          </button>
        ))}
      </div>
      <div className="system-controls">
        <button
          className="button button-primary"
          aria-pressed={playing}
          onClick={() => {
            if (time >= duration) seek(0);
            setPlaying((value) => !value);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? c.pause : c.play}
        </button>
        <button
          className="button button-secondary"
          onClick={() =>
            seek(Math.min(duration, time + (system === "solar" ? 0.1 : 0.05)))
          }
        >
          <SkipForward size={16} />
          {c.step}
        </button>
        <button
          className="button button-secondary"
          onClick={() => {
            seek(0);
            setFocused(false);
            setCameraView("tilted");
            canvasApi.current?.camera("tilted");
          }}
        >
          <RotateCcw size={16} />
          {c.reset}
        </button>
        <label className="system-speed">
          {c.speed}
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {[0.25, 1, 4].map((value) => (
              <option key={value} value={value}>
                {number(value, value < 1 ? 2 : 0)}{" "}
                {system === "solar" ? c.yearSecond : c.unitSecond}
              </option>
            ))}
          </select>
        </label>
        <span data-testid="system-status" role="status">
          {playing ? c.running : time >= duration ? c.complete : c.paused}
        </span>
      </div>
      <div className="system-time">
        <label htmlFor={`${uid}-time`}>
          {c.time}
          <output data-testid="system-time">
            {number(snapshot.time, 2)} {unit}
          </output>
        </label>
        <input
          id={`${uid}-time`}
          type="range"
          min="0"
          max={duration}
          step=".05"
          value={snapshot.time}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </div>
      {snapshot.halted && (
        <p role="status">
          {c.stopped}: {snapshot.reason}
        </p>
      )}
      <details className="system-note">
        <summary>{c.model}</summary>
        <p>{system === "solar" ? c.solarNote : c.tripleNote}</p>
        <p>{system === "solar" ? c.scale : c.tripleScale}</p>
        <a
          href="https://github.com/mmkolpakov/Geometry-System/blob/main/docs/models.md"
          target="_blank"
          rel="noreferrer"
        >
          {c.source} ↗
        </a>
      </details>
    </section>
  );
}
