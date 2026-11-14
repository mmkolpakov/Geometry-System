import { useLocale } from "../i18n";
import { useId, useMemo, useState } from "react";
import { mat4, vec3 } from "gl-matrix";

/** A projection discards depth; rotating the same 3D points reveals the lost information. */
export function DimensionDemo() {
  const { t, locale, number } = useLocale();
  const [angle, setAngle] = useState(0);
  const id = useId();
  const points = useMemo(() => {
    const rotation = mat4.fromYRotation(mat4.create(), (angle * Math.PI) / 180);
    return [
      [0, 0, -1],
      [0, 0, 1],
    ].map((point) =>
      vec3.transformMat4(
        vec3.create(),
        point as [number, number, number],
        rotation,
      ),
    );
  }, [angle]);
  return (
    <section
      className="formula-card projection-demo"
      aria-label={t("Размерность и проекция")}
    >
      <h3>{t("Почему плоский рисунок не рассказывает всё")}</h3>
      <p>
        {t(
          "Две неподвижные точки в 3D проецируются на экран. Их глубина теряется в изображении, но сохраняется в модели.",
        )}
      </p>
      <p>
        {t(
          "Исходные точки: A = (0, 0, −1), B = (0, 0, 1). Их расстояние в пространстве всегда равно 2.",
        )}
      </p>
      <svg
        viewBox="0 0 600 160"
        role="img"
        aria-labelledby={`${id}-title`}
        data-testid="dimension-visual"
      >
        <title id={`${id}-title`}>
          {t(
            "При нулевом повороте проекции двух разных точек совпадают. При повороте они расходятся.",
          )}
        </title>
        <path
          d="M40 80H560M300 20V140"
          stroke="#9cab99"
          strokeWidth="1"
          strokeDasharray="4 5"
        />
        <text x="22" y="24" fill="#465e3d" fontSize="12">
          {t("ПРОЕКЦИЯ НА ЭКРАН · ГЛУБИНА СКРЫТА")}
        </text>
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={300 + p[0] * 120}
              cy={80 - p[1] * 80}
              r={i ? 9 : 14}
              fill={i ? "#95652a" : "none"}
              stroke={i ? "#95652a" : "#356350"}
              strokeWidth="3"
            />
            <text
              x={300 + p[0] * 120}
              y={i ? 117 : 51}
              textAnchor="middle"
              fontSize="12"
              fill="#354d32"
            >
              {i ? "B" : "A"}
            </text>
          </g>
        ))}
      </svg>
      <label className="range-label" htmlFor={`${id}-rotation`}>
        {t("Поворот объекта")}
        <output>{angle}°</output>
      </label>
      <input
        id={`${id}-rotation`}
        type="range"
        min="0"
        max="90"
        step="1"
        value={angle}
        onChange={(event) => setAngle(Number(event.target.value))}
      />
      <p data-testid="projection-distance">
        {t("Расстояние в пространстве:")}
        <strong>{number(2, 2)}</strong> {t("· на изображении:")}{" "}
        <strong>{number(Math.abs(points[1][0] - points[0][0]), 2)}</strong>
      </p>
      <small>
        {t(
          "Ортографическая проекция π(x, y, z) = (x, y). Поворот вычисляет gl-matrix. Удаление координаты из изображения не меняет размерность исходного пространства.",
        )}
      </small>
    </section>
  );
}
