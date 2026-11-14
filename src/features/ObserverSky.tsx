import { useId } from "react";
import type { Body } from "../domain/nbody";
import { observe } from "../domain/observer";

const colors = ["#9be1cb", "#f2cf8d", "#c8b6f1"];
const number = (value: number, digits = 3) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: digits });

export function ObserverSky({
  bodies,
  time,
}: {
  bodies: Body[];
  time: number;
}) {
  const id = useId();
  let sky;
  try {
    sky = observe(bodies);
  } catch {
    return (
      <p className="lab-note" role="status">
        Наблюдение недоступно: координаты некорректны или источник совпал с наблюдателем.
        Динамический расчёт не изменён.
      </p>
    );
  }
  return (
    <section
      className="observer-sky"
      aria-label="Небо неподвижного наблюдателя"
      data-testid="observer-sky"
    >
      <div className="observer-heading">
        <h3>Одни траектории — другое небо</h3>
        <span>t = {number(time, 2)}</span>
      </div>
      <p>
        Наблюдатель закреплён в точке (0; −4). Смотрите, как меняются
        направления на три источника и их суммарный поток.
      </p>
      <svg
        className="scene-svg observer-strip"
        viewBox="0 0 600 205"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>
          Направления на три источника в момент {number(time, 2)}
        </title>
        <desc id={`${id}-desc`}>
          Развёртка 360 градусов. Ноль соответствует направлению +y. Источники
          разнесены по строкам только для читаемости. Значения направлений и
          потоков приведены под рисунком.
        </desc>
        <rect width="600" height="205" fill="#10212b" rx="8" />
        {[0, 90, 180, 270, 360].map((angle) => (
          <g key={angle} fill="#bed0d6">
            <path
              d={`M${48 + angle * 1.4} 28v134`}
              stroke="#bed0d6"
              strokeOpacity=".15"
            />
            <text
              x={48 + angle * 1.4}
              y="187"
              textAnchor="middle"
              fontSize="13"
            >
              {angle}°
            </text>
          </g>
        ))}
        {sky.stars.map((star, index) => (
          <g key={index}>
            <path
              d={`M48 ${48 + index * 48}h504`}
              stroke={colors[index]}
              strokeOpacity=".18"
            />
            <circle
              cx={48 + star.azimuth * 1.4}
              cy={48 + index * 48}
              r="7"
              fill={colors[index]}
            />
            <text x="16" y={53 + index * 48} fontSize="13" fill={colors[index]}>
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="observer-measurements">
        <table className="coordinate-table">
          <caption>Мгновенные направления и условный поток</caption>
          <thead>
            <tr>
              <th scope="col">Источник</th>
              <th scope="col">Азимут</th>
              <th scope="col">Поток</th>
            </tr>
          </thead>
          <tbody>
            {sky.stars.map((star, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                <td>{number(star.azimuth, 1)}°</td>
                <td>{number(star.flux, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="observer-total">
          Суммарный поток{" "}
          <strong data-testid="observer-flux">
            {number(sky.totalFlux, 5)}
          </strong>
          <small>условных единиц · F = Σ 1/rᵢ²</small>
        </p>
      </div>
      <p className="model-boundary">
        Наблюдатель не является планетой и не участвует в гравитации. Источникам
        условно задана одинаковая постоянная светимость; поток нормирован так,
        что при r = 1 он равен 1. Пояс показывает направления, а не фотографию
        неба: строки не означают высоту. Размеры звёзд, затмения, задержка
        света, цвет и климат не моделируются.
      </p>
    </section>
  );
}
