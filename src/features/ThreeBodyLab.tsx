import { useLocale } from '../i18n';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { diagnostics, NUMERICS, PRESETS, simulate, type PresetId, type Vector2 } from '../domain/nbody';
import { ObserverSky } from './ObserverSky';

interface ThreeBodyLabProps {
  preset: PresetId;
  onPresetChange: (preset: PresetId) => void;
  advanced: boolean;
  comparisonEnabled: boolean;
  onComparisonChange: (enabled: boolean) => void;
  perturbation: number;
  onPerturbationChange: (value: number) => void;
  sampleIndex: number;
  onSampleIndexChange: (index: number) => void;
}

const COLORS = ['#9be1cb', '#f2cf8d', '#c8b6f1'];
const DURATION = 20;
const STEP = 0.004;

export function ThreeBodyLab(props: ThreeBodyLabProps) {
  // Preset changes begin paused. Parameter changes preserve keyboard focus.
  return <ThreeBodyExperiment key={props.preset} {...props} />;
}

function ThreeBodyExperiment({ preset, onPresetChange, advanced, comparisonEnabled, onComparisonChange, perturbation, onPerturbationChange, sampleIndex, onSampleIndexChange }: ThreeBodyLabProps) {
  const { t, number, locale } = useLocale();
  const format = (value: number, digits = 3) => number(value, digits);
  const tiny = (value: number) => Math.abs(value) < 1e-12 ? '0' : value.toExponential(2).replace('.', locale === 'zh-CN' ? '.' : ',');
  const simulation = useMemo(() => simulate(preset, DURATION / STEP, STEP), [preset]);
  const comparison = useMemo(
    () => comparisonEnabled ? simulate(preset, DURATION / STEP, STEP, perturbation) : null,
    [preset, comparisonEnabled, perturbation],
  );
  let maxIndex = Math.min(simulation.samples.length, comparison?.samples.length ?? Infinity) - 1;
  // A halted run can end between regular snapshots. Compare only equal times.
  if (comparison && Math.abs(simulation.samples[maxIndex].time - comparison.samples[maxIndex].time) > 1e-10) maxIndex -= 1;
  const [playing, setPlaying] = useState(false);
  const [showObserver, setShowObserver] = useState(false);
  const currentIndex = Math.min(sampleIndex, maxIndex);
  const sample = simulation.samples[currentIndex];
  const playbackTime = useRef(sample.time);
  const lastEmittedFrame = useRef(currentIndex);
  const onFrame = useRef(onSampleIndexChange);
  onFrame.current = onSampleIndexChange;
  const comparisonSample = comparison?.samples[currentIndex];
  const measurements = useMemo(() => diagnostics(sample.bodies), [sample]);
  const drift = (sample.energy - simulation.initialEnergy) / Math.abs(simulation.initialEnergy);
  const difference = comparisonSample ? Math.sqrt(sample.bodies.reduce((total, body, index) => total
    + (body.position.x - comparisonSample.bodies[index].position.x) ** 2
    + (body.position.y - comparisonSample.bodies[index].position.y) ** 2, 0) / 3) : 0;
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    setPlaying(false);
    playbackTime.current = sample.time;
  }, [comparisonEnabled, perturbation]);

  useEffect(() => {
    // External navigation to another shared frame pauses local playback.
    if (sampleIndex !== lastEmittedFrame.current) {
      playbackTime.current = sample.time;
      lastEmittedFrame.current = currentIndex;
      setPlaying(false);
    }
  }, [sampleIndex, currentIndex, sample.time]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | undefined;
    const animate = (timestamp: number) => {
      if (previous !== undefined) playbackTime.current += Math.min((timestamp - previous) / 1000, 0.1);
      previous = timestamp;
      const lastTime = simulation.samples[maxIndex].time;
      if (playbackTime.current >= lastTime) {
        playbackTime.current = lastTime;
        lastEmittedFrame.current = maxIndex;
        onFrame.current(maxIndex);
        setPlaying(false);
        return;
      }
      // Snapshots share a fixed stride; use their actual times for the last frame.
      const stride = simulation.samples[1]?.time || STEP;
      const index = Math.min(maxIndex, Math.floor(playbackTime.current / stride));
      if (index !== lastEmittedFrame.current) {
        lastEmittedFrame.current = index;
        onFrame.current(index);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, simulation, maxIndex]);

  const projection = useMemo(() => {
    const points = [...simulation.trails.flat(), ...(comparison?.trails.flat() ?? [])];
    const minimumX = Math.min(...points.map(point => point.x));
    const maximumX = Math.max(...points.map(point => point.x));
    const minimumY = Math.min(...points.map(point => point.y));
    const maximumY = Math.max(...points.map(point => point.y));
    const centerX = (minimumX + maximumX) / 2;
    const centerY = (minimumY + maximumY) / 2;
    const scale = Math.min(470 / Math.max(maximumX - minimumX, 1), 330 / Math.max(maximumY - minimumY, 1));
    return {
      point: (point: Vector2) => ({ x: 300 + (point.x - centerX) * scale, y: 222 - (point.y - centerY) * scale }),
      scale,
    };
  }, [simulation, comparison]);

  const path = (points: Vector2[]) => points.map((point, index) => {
    const screen = projection.point(point);
    return `${index === 0 ? 'M' : 'L'}${screen.x.toFixed(2)},${screen.y.toFixed(2)}`;
  }).join(' ');

  const reset = () => {
    setPlaying(false);
    lastEmittedFrame.current = 0;
    onFrame.current(0);
    playbackTime.current = 0;
  };
  const seek = (index: number) => {
    setPlaying(false);
    lastEmittedFrame.current = index;
    onFrame.current(index);
    playbackTime.current = simulation.samples[index].time;
  };
  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (currentIndex === maxIndex) {
        lastEmittedFrame.current = 0;
        onFrame.current(0);
        playbackTime.current = 0;
      }
      setPlaying(true);
    }
  };
  const scaleLength = projection.scale >= 50 ? 1 : projection.scale >= 20 ? 2 : 5;

  return (
    <section className="lab-panel threebody-lab" aria-label={t("Лаборатория трёх тел")}>
      <div className="lab-toolbar">
        <div className="segmented" role="group" aria-label={t("Начальные условия трёх тел")}>
          {PRESETS.map(option => (
            <button type="button" key={option.id} aria-pressed={preset === option.id} onClick={() => onPresetChange(option.id)}>
              {t(option.name)}
            </button>
          ))}
        </div>
        <span className="geometry-curvature">G = 1 · m = 1</span>
      </div>

      <div className="threebody-scene">
        <svg className="scene-svg" viewBox="0 0 600 440" role="img" aria-labelledby={`${uid}-title ${uid}-desc`} data-testid="threebody-visual">
          <title id={`${uid}-title`}>{t("{preset}: движение трёх равных масс").replace("{preset}", t(PRESETS.find(option => option.id === preset)?.name ?? ""))}</title>
          <desc id={`${uid}-desc`}>
            {t("Время {time} модельных единиц. Сплошные цветные линии показывают пройденный путь каждого тела с номером от 1 до 3.").replace("{time}", format(sample.time, 2))}
            {t("Бледные линии показывают весь предварительно рассчитанный путь до конца опыта.")}
            {comparisonEnabled ? t('Пунктир — сравнение с изменением начальной скорости. Среднеквадратичное расхождение положений: {difference}.').replace('{difference}', format(difference, 5)) : ''}
            {t("Численные координаты и энергия доступны ниже рисунка.")}
          </desc>
          <defs>
            <pattern id={`${uid}-grid`} width="37" height="37" patternUnits="userSpaceOnUse">
              <path d="M37 0H0V37" fill="none" stroke="#90a3b7" strokeOpacity="0.1" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="600" height="440" fill={`url(#${uid}-grid)`} />
          <text x="22" y="26" fill="#90a3b7" fontSize="11" fontFamily="inherit" letterSpacing={locale === 'zh-CN' ? undefined : '1.5'}>{t("НЬЮТОНОВСКАЯ МЕХАНИКА · 2D")}</text>
          <text x="22" y="44" fill="#90a3b7" fontSize="10" fontFamily="inherit">{t("Бледные линии — весь рассчитанный путь")}</text>
          {simulation.trails.map((trail, index) => (
            <path key={`future-${index}`} d={path(trail.slice(0, maxIndex + 1))} fill="none" stroke={COLORS[index]} strokeOpacity="0.12" strokeWidth="1.3" />
          ))}
          {simulation.trails.map((trail, index) => (
            <path key={`trail-${index}`} d={path(trail.slice(0, currentIndex + 1))} fill="none" stroke={COLORS[index]} strokeOpacity="0.88" strokeWidth="2" strokeLinejoin="round" />
          ))}
          {comparison?.trails.map((trail, index) => (
            <path key={`comparison-${index}`} d={path(trail.slice(0, currentIndex + 1))} fill="none" stroke={COLORS[index]} strokeOpacity="0.68" strokeWidth="1.7" strokeDasharray="5 5" />
          ))}
          {comparisonSample?.bodies.map((body, index) => {
            const point = projection.point(body.position);
            return <circle key={`comparison-body-${index}`} cx={point.x} cy={point.y} r="10" fill="none" stroke={COLORS[index]} strokeDasharray="3 3" strokeWidth="1.5" />;
          })}
          {sample.bodies.map((body, index) => {
            const point = projection.point(body.position);
            return (
              <g key={`body-${index}`}>
                <circle cx={point.x} cy={point.y} r="6" fill={COLORS[index]} stroke="#101827" strokeWidth="2" />
                <text x={point.x + 12} y={point.y - 10} fill={COLORS[index]} fontSize="13" fontWeight="600" fontFamily="inherit">{index + 1}</text>
              </g>
            );
          })}
          <path d={`M22 397v6h${(scaleLength * projection.scale).toFixed(2)}v-6`} fill="none" stroke="#90a3b7" strokeWidth="1" />
          <text x="22" y="420" fill="#90a3b7" fontSize="10" fontFamily="inherit">{t("{length} ед. длины · размер тел условный").replace("{length}", format(scaleLength, 0))}</text>
          <text x="578" y="416" fill="#90a3b7" fontSize="11" fontFamily="inherit" textAnchor="end">t = {format(sample.time, 2)}</text>
        </svg>
      </div>

      <div className="experiment-controls">
        <div className="playback-controls">
          <button type="button" className="button button-primary" onClick={togglePlayback} aria-pressed={playing}>
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? t('Пауза') : currentIndex === maxIndex ? t('Повторить') : t('Запустить')}
          </button>
          <button type="button" className="button button-secondary" onClick={() => seek(Math.min(currentIndex + 1, maxIndex))} disabled={currentIndex === maxIndex}>
            <SkipForward size={16} aria-hidden="true" /> {t("Шаг")}
          </button>
          <button type="button" className="button button-secondary" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" /> {t("Сброс")}
          </button>
          <span className="threebody-status" data-testid="playback-status" role="status">{playing ? t('Воспроизведение') : currentIndex === maxIndex ? t('Расчёт показан целиком') : t('На паузе')}</span>
        </div>
        <div className="range-label">
          <label htmlFor={`${uid}-time`}>{t("Время модели")}</label>
          <output htmlFor={`${uid}-time`}>{format(sample.time, 2)} / {format(simulation.samples[maxIndex].time, 2)}</output>
        </div>
        <input id={`${uid}-time`} type="range" min="0" max={maxIndex} step="1" value={currentIndex} onChange={event => seek(Number(event.currentTarget.value))} aria-valuetext={t("{time} модельных единиц времени").replace("{time}", format(sample.time, 2))} />
        <p className="control-hint">{t("Движение начинается только по вашей команде. «Шаг» показывает следующий сохранённый кадр, а не один шаг интегратора.")}</p>
        <label className="comparison-toggle" htmlFor={`${uid}-compare`}>
          <input id={`${uid}-compare`} type="checkbox" checked={comparisonEnabled} onChange={event => { reset(); onComparisonChange(event.currentTarget.checked); }} />
          {t("Сравнить близкие начальные условия")}
        </label>
        <label className="comparison-toggle" htmlFor={`${uid}-observer`}>
          <input id={`${uid}-observer`} type="checkbox" checked={showObserver} onChange={event => setShowObserver(event.currentTarget.checked)} />
          {t("Небо неподвижного наблюдателя")}
        </label>
        {comparisonEnabled && (
          <div className="comparison-settings">
            <div className="range-label">
              <label htmlFor={`${uid}-perturbation`}>{t("Изменение начальной скорости Δvₓ")}</label>
              <output htmlFor={`${uid}-perturbation`}>{tiny(perturbation)}</output>
            </div>
            <input id={`${uid}-perturbation`} type="range" min="1" max="10" step="1" value={Math.round(perturbation * 10000)} onChange={event => { reset(); onPerturbationChange(Number(event.currentTarget.value) / 10000); }} aria-valuetext={tiny(perturbation)} />
            <p className="control-hint">{t("Меняем vₓ первого тела, затем вычитаем скорость центра масс у всех трёх. Пунктир — второй расчёт с тем же законом и шагом.")}</p>
          </div>
        )}
      </div>

      <div className="metric-grid">
        <div className="metric"><span>{t("Время модели")}</span><strong data-testid="simulation-time">{format(sample.time, 2)}</strong><small>{t("Условные единицы, не годы")}</small></div>
        <div className="metric"><span>{t("Полная энергия E")}</span><strong>{format(sample.energy, 5)}</strong><small>{t("Кинетическая + потенциальная")}</small></div>
        <div className="metric"><span>{t("Дрейф энергии")}</span><strong data-testid="energy-drift">{tiny(drift * 100)}%</strong><small>{t("От начального значения")}</small></div>
      </div>
      {showObserver && <ObserverSky bodies={sample.bodies} time={sample.time} />}

      {comparisonEnabled && (
        <p className="lab-note comparison-result" role="status">{t("Среднеквадратичное расхождение положений:")} <strong>{format(difference, 5)}</strong> {t("ед. длины. Видимое расхождение само по себе не доказывает хаос.")}</p>
      )}
      {(simulation.halted || comparison?.halted) && (
        <p className="lab-note" role="status"><strong>{t("Расчёт ограничен:")}</strong> {t(simulation.reason || comparison?.reason || '')} {t("Показаны последние состояния до защитной остановки; измените начальные условия для другого опыта.")}</p>
      )}

      <div className="lab-note">
        <h3>{preset === 'triangle' ? t('Три тела могут двигаться упорядоченно') : preset === 'figure-eight' ? t('Одна орбита, три участника') : t('Один закон, разные траектории')}</h3>
        <p>{t(PRESETS.find(option => option.id === preset)?.description ?? '')} {preset === 'triangle' ? t('Расстояния сохраняются благодаря специальным начальным условиям. Общее решение трёх тел так не выглядит.') : preset === 'figure-eight' ? t('Тела проходят по одной кривой со сдвигом во времени. Приближённое воспроизведение не заменяет математическое доказательство периодичности.') : t('Включите сравнение и прокрутите время. Отличайте чувствительность к начальным условиям от численной погрешности.')}</p>
      </div>

      <details className="formula-card" open={advanced || undefined}>
        <summary>{t("Координаты и точность расчёта")}</summary>
        <div className="coordinate-table-wrap">
          <table className="coordinate-table">
            <caption>{t("Положения в момент t = {time}, относительно центра масс").replace("{time}", format(sample.time, 2))}</caption>
            <thead><tr><th scope="col">{t("Тело")}</th><th scope="col">x</th><th scope="col">y</th></tr></thead>
            <tbody>{sample.bodies.map((body, index) => <tr key={index}><th scope="row">{index + 1}</th><td>{format(body.position.x, 5)}</td><td>{format(body.position.y, 5)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="formula">aᵢ = Σⱼ≠ᵢ Gmⱼ(rⱼ − rᵢ) / |rⱼ − rᵢ|³</p>
        <p>{t("{solver}: адаптивный расчёт с абсолютным и относительным допуском 10⁻⁹. Интервал вывода — {interval}; шаг интегрирования выбирает библиотека. Дрейф = (E(t) − E(0)) / |E(0)|. Начальная энергия: {energy}.").replace("{solver}", NUMERICS.solver).replace("{interval}", format(STEP, 3)).replace("{energy}", format(simulation.initialEnergy, 5))}</p>
        <p>{t("Модуль полного импульса: {momentum}. Угловой момент: {angular}. Минимальное расстояние сейчас: {distance}.").replace("{momentum}", tiny(measurements.momentum)).replace("{angular}", format(measurements.angularMomentum, 5)).replace("{distance}", format(measurements.minDistance, 4))}</p>
        <p>{t("Сближение менее 0,03 или относительная ошибка энергии более 1% останавливают расчёт. Малый дрейф энергии не гарантирует точность каждой координаты.")}</p>
      </details>
      <p className="model-boundary">{t("Три точечные массы на плоскости, ньютоновская гравитация. Это учебная модель, а не реконструкция Трисоляриса: здесь нет размеров звёзд, планеты, климата и эффектов относительности.")}</p>
    </section>
  );
}
