import { useId, useMemo } from 'react';
import { createTriangle, type GeometryKind, type Point2 } from '../domain/geometry';

interface GeometryLabProps {
  kind: GeometryKind;
  size: number;
  onKindChange: (kind: GeometryKind) => void;
  onSizeChange: (size: number) => void;
  advanced: boolean;
}

const modes: { id: GeometryKind; label: string; sign: string }[] = [
  { id: 'flat', label: 'Плоскость', sign: 'K = 0' },
  { id: 'sphere', label: 'Сфера', sign: 'K > 0' },
  { id: 'hyperbolic', label: 'Гиперболическая', sign: 'K < 0' },
];

const explanations: Record<GeometryKind, { title: string; observation: string; projection: string; metric: string }> = {
  flat: {
    title: 'Привычные 180°',
    observation: 'Увеличьте треугольник: площадь изменится, а сумма углов останется равной 180°. Его стороны — прямые на плоскости.',
    projection: 'Плоская геометрия. Все длины указаны в единицах выбранного масштаба.',
    metric: 'ds² = dx² + dy². Кривизна K = 0, поэтому α + β + γ = π при любом размере треугольника.',
  },
  sphere: {
    title: 'На сфере углов больше',
    observation: 'Чем больше треугольник, тем заметнее избыток над 180°. При максимальном размере его три угла прямые: 90° + 90° + 90° = 270°.',
    projection: 'Ортографическая проекция сферы. Числа показывают углы на поверхности: на плоском экране они могут выглядеть иначе.',
    metric: 'ds² = R²(dθ² + sin²θ dφ²), K = 1/R². Стороны — короткие дуги больших окружностей. Здесь R = 1.',
  },
  hyperbolic: {
    title: 'В гиперболическом мире углов меньше',
    observation: 'Расширьте треугольник к границе: сумма углов уменьшится. Кратчайшие пути изгибаются на рисунке, но в этой геометрии они играют роль прямых.',
    projection: 'Диск Пуанкаре сохраняет углы, но искажает длины. Окружность — бесконечно далёкая граница, она не входит в пространство.',
    metric: 'ds² = 4R²(dx² + dy²)/(1 − x² − y²)², K = −1/R². Геодезические — диаметры или дуги, ортогональные границе. Здесь R = 1.',
  },
};

const number = (value: number, digits = 1) => value.toLocaleString('ru-RU', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

function projected(point: Point2): Point2 {
  return { x: 300 + point.x * 185, y: 220 + point.y * 185 };
}

function pathData(points: Point2[], close = false): string {
  return points.map((point, index) => {
    const screen = projected(point);
    return `${index === 0 ? 'M' : 'L'} ${screen.x.toFixed(3)} ${screen.y.toFixed(3)}`;
  }).join(' ') + (close ? ' Z' : '');
}

export function GeometryLab({ kind, size, onKindChange, onSizeChange, advanced }: GeometryLabProps) {
  const triangle = useMemo(() => createTriangle(kind, size), [kind, size]);
  const id = useId().replace(/:/g, '');
  const rangeId = `${id}-size`;
  const gridId = `${id}-grid`;
  const surfaceId = `${id}-surface`;
  const information = explanations[kind];
  const names = ['α', 'β', 'γ'];
  const fillPath = pathData(triangle.paths.flat(), true);
  const difference = triangle.angleSum - 180;

  return (
    <section className="lab-panel geometry-lab" aria-label="Лаборатория геометрии">
      <div className="lab-toolbar">
        <div className="segmented" role="group" aria-label="Выберите геометрию">
          {modes.map(mode => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={kind === mode.id}
              onClick={() => onKindChange(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <span className="geometry-curvature">{modes.find(mode => mode.id === kind)?.sign}</span>
      </div>

      <div className={`geometry-scene geometry-scene--${kind}`}>
        <svg
          className="scene-svg"
          viewBox="0 0 600 440"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
          data-testid="geometry-visual"
        >
          <title id={`${id}-title`}>{modes.find(mode => mode.id === kind)?.label}: геодезический треугольник</title>
          <desc id={`${id}-description`}>
            Сумма внутренних углов {number(triangle.angleSum)} градуса.
            Углы {triangle.angles.map(angle => number(angle)).join(', ')} градуса.
            {information.projection}
          </desc>
          <defs>
            <pattern id={gridId} width="37" height="37" patternUnits="userSpaceOnUse">
              <path d="M 37 0 H 0 V 37" fill="none" stroke="#90a3b7" strokeOpacity="0.1" strokeWidth="1" />
            </pattern>
            <radialGradient id={surfaceId} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#253c4b" />
              <stop offset="100%" stopColor="#121e2b" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="600" height="440" fill={`url(#${gridId})`} />
          {triangle.outline && (
            <path
              d={pathData(triangle.outline, true)}
              fill={`url(#${surfaceId})`}
              stroke="#718799"
              strokeWidth="1.5"
              strokeDasharray={kind === 'hyperbolic' ? '5 6' : undefined}
            />
          )}
          {kind === 'sphere' && (
            <ellipse cx="300" cy="220" rx="185" ry="62" fill="none" stroke="#718799" strokeOpacity="0.22" strokeDasharray="3 6" />
          )}
          <path d={fillPath} fill="#9be1cb" fillOpacity="0.13" />
          {triangle.paths.map((points, index) => (
            <path key={index} d={pathData(points)} fill="none" stroke="#9be1cb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {triangle.paths.map((points, index) => {
            const point = projected(points[0]);
            const direction = {
              x: point.x < 295 ? -1 : point.x > 305 ? 1 : 0,
              y: point.y < 215 ? -1 : 1,
            };
            return (
              <g key={names[index]}>
                <circle cx={point.x} cy={point.y} r="6" fill="#f2cf8d" stroke="#101827" strokeWidth="2" />
                <text
                  x={point.x + direction.x * 24}
                  y={point.y + direction.y * 27}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#f2cf8d"
                  fontSize="15"
                  fontFamily="inherit"
                >
                  {names[index]} · {number(triangle.angles[index])}°
                </text>
              </g>
            );
          })}
          <text x="22" y="26" fill="#90a3b7" fontSize="11" fontFamily="inherit" letterSpacing="1.5">ГЕОДЕЗИЧЕСКИЕ</text>
          <text x="578" y="416" fill="#90a3b7" fontSize="11" fontFamily="inherit" textAnchor="end">
            {kind === 'sphere' ? 'R = 1 · проекция сферы' : kind === 'hyperbolic' ? 'R = 1 · диск Пуанкаре' : 'Евклидова плоскость'}
          </text>
        </svg>
      </div>

      <div className="experiment-controls">
        <div className="range-label">
          <label htmlFor={rangeId}>Размер треугольника</label>
          <output htmlFor={rangeId}>{Math.round(size * 100)}%</output>
        </div>
        <input
          id={rangeId}
          type="range"
          min="0.25"
          max="1"
          step="0.01"
          value={size}
          onChange={event => onSizeChange(Number(event.currentTarget.value))}
        />
        <p className="control-hint">Кривизна постоянна. Меняется только размер фигуры.</p>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>Сумма углов</span>
          <strong data-testid="angle-sum">{number(triangle.angleSum)}°</strong>
          <small>{Math.abs(difference) < 0.0001 ? 'Ровно 180°' : `${difference > 0 ? '+' : '−'}${number(Math.abs(difference))}° к плоскому случаю`}</small>
        </div>
        <div className="metric">
          <span>Каждый угол</span>
          <strong>{number(triangle.angles[0])}°</strong>
          <small>α = β = γ · симметричный треугольник</small>
        </div>
        <div className="metric">
          <span>Площадь</span>
          <strong>{number(triangle.area, 3)}</strong>
          <small>{kind === 'flat' ? 'Квадратных единиц' : 'В единицах R²'}</small>
        </div>
      </div>

      <div className="lab-note">
        <h3>{information.title}</h3>
        <p>{information.observation}</p>
        <p className="projection-note">{information.projection}</p>
      </div>

      {advanced && (
        <div className="formula-card">
          <h3>Измерение на поверхности</h3>
          <p className="formula">α + β + γ − π = K · A</p>
          <p>Формула Гаусса — Бонне для геодезического треугольника постоянной кривизны. В формуле углы в радианах, A — площадь на поверхности.</p>
          <p>{information.metric}</p>
          <dl className="geometry-diagnostics">
            <div><dt>Кривизна K</dt><dd>{number(triangle.curvature, 0)}</dd></div>
            {triangle.sideLengths.map((length, index) => (
              <div key={index}><dt>Сторона {index + 1}</dt><dd>{number(length, 3)}</dd></div>
            ))}
          </dl>
        </div>
      )}
      <p className="model-boundary">Это двумерные геометрии постоянной кривизны. Опыт не измеряет кривизну нашей Вселенной и не моделирует пространство-время.</p>
    </section>
  );
}
