import { useId } from "react";
import { useLocale } from "../i18n";
import type { StoryCase } from "../content/story";

type Props = { event: StoryCase; phase: number };
export function StoryScene({ event, phase }: Props) {
  const { locale } = useLocale(),
    uid = useId().replace(/:/g, ""),
    at = (name: string) => `url(#${uid}-${name})`;
  const zh = locale === "zh-CN",
    collapse = event.id === "deterrence-collapse",
    signal = ["signal", "reply"].includes(event.visual),
    isBattle = event.id === "darkness-battle";
  const earth = (x = 120, y = 325, r = 43) => (
    <g>
      <circle cx={x} cy={y} r={r + 6} fill={at("atmosphere")} />
      <circle cx={x} cy={y} r={r} fill={at("earth")} />
      <path
        d={`M${x - r * 0.65} ${y - r * 0.4}q${r * 0.6} ${-r * 0.4} ${r * 0.55} ${r * 0.15}t${r * 0.5} ${r * 0.4}q${-r * 0.7} ${r * 0.2} ${-r * 0.5} ${r * 0.7}q${-r * 0.6} ${-r * 0.1} ${-r * 0.55} ${-r * 0.65}Z`}
        fill="#6f9b78"
        opacity=".75"
      />
      <text x={x} y={y + r + 25} textAnchor="middle">
        {zh ? "地球" : "Земля"}
      </text>
    </g>
  );
  const sun = (x = 330, y = 240, r = 49, color = "sun") => (
    <g>
      <circle cx={x} cy={y} r={r * 2.1} fill={at("glow")} />
      <circle cx={x} cy={y} r={r} fill={at(color)} />
    </g>
  );
  const triple = (x = 640, y = 210, destroyed = false) => (
    <g opacity={destroyed ? 0.24 : 1}>
      {sun(x - 35, y - 25, 24)}
      {sun(x + 43, y - 8, 19, "blue")}
      {sun(x + 2, y + 47, 21, "red")}
      <ellipse
        cx={x + 7}
        cy={y + 15}
        rx="106"
        ry="72"
        fill="none"
        stroke="#c6a373"
        strokeOpacity=".2"
        transform={`rotate(-22 ${x} ${y})`}
      />
      <circle cx={x - 75} cy={y + 58} r="10" fill={at("earth")} />
      <text x={x} y={y + 114} textAnchor="middle">
        {zh ? "三体星系" : "Трисолярис"}
      </text>
    </g>
  );
  const ship = (x: number, y: number, scale = 1, rotation = 0, dim = false) => (
    <g
      key={`${x}-${y}-${scale}`}
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}
      opacity={dim ? 0.15 : 1}
    >
      <path
        d="M-18 0L12-7L28 0L12 7Z"
        fill={at("metal")}
        stroke="#b5d2e1"
        strokeWidth=".8"
      />
      <path d="M-17-2L-31 0L-17 2Z" fill="#8de9ff" opacity=".8" />
      <path d="M4-4L14-4M4 4L14 4" stroke="#e4f5fa" strokeWidth="1" />
    </g>
  );
  const waves = (x: number, y: number, count: number, color = "#81d7ea") => (
    <g fill="none" stroke={color}>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={24 + i * 31}
          opacity={0.8 - i * 0.14}
          strokeWidth="1.5"
        />
      ))}
    </g>
  );
  const beam = (d: string, color = "#91deee", width = 2) => (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      filter={at("soft")}
    />
  );
  const fleet = (destroyed = false) => (
    <g>
      {Array.from({ length: 24 }, (_, i) =>
        ship(
          260 + (i % 6) * 57,
          190 + Math.floor(i / 6) * 48,
          0.64,
          180,
          destroyed && i < 22,
        ),
      )}
    </g>
  );
  const flash = (x: number, y: number, r: number) => (
    <g>
      <circle cx={x} cy={y} r={r * 2.8} fill={at("blast")} />
      <path
        d={`M${x - r * 2.2} ${y}H${x + r * 2.2}M${x} ${y - r * 1.6}V${y + r * 1.6}`}
        stroke="#fff0ce"
        strokeWidth="2"
      />
    </g>
  );
  return (
    <svg
      className="story-scene"
      viewBox="0 0 800 500"
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
      data-testid="story-scene"
      data-visual={event.visual}
      data-phase={phase}
    >
      <title id={`${uid}-title`}>
        {event.title[locale]} — {event.steps[phase].title[locale]}
      </title>
      <desc id={`${uid}-desc`}>{event.steps[phase].detail[locale]}</desc>
      <defs>
        <radialGradient id={`${uid}-space`}>
          <stop stopColor="#1a3046" />
          <stop offset="1" stopColor="#060d18" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop stopColor="#ffc976" stopOpacity=".6" />
          <stop offset=".4" stopColor="#e88f43" stopOpacity=".17" />
          <stop offset="1" stopColor="#e88f43" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-sun`} cx=".32" cy=".28">
          <stop stopColor="#fff8d8" />
          <stop offset=".65" stopColor="#ffc162" />
          <stop offset="1" stopColor="#c86a36" />
        </radialGradient>
        <radialGradient id={`${uid}-blue`} cx=".3" cy=".25">
          <stop stopColor="#f0f9ff" />
          <stop offset=".7" stopColor="#9dc9e8" />
          <stop offset="1" stopColor="#406d9e" />
        </radialGradient>
        <radialGradient id={`${uid}-red`} cx=".3" cy=".25">
          <stop stopColor="#ffe9bc" />
          <stop offset=".7" stopColor="#e59163" />
          <stop offset="1" stopColor="#9f4837" />
        </radialGradient>
        <radialGradient id={`${uid}-earth`} cx=".28" cy=".28">
          <stop stopColor="#77bcdb" />
          <stop offset=".48" stopColor="#2c6793" />
          <stop offset="1" stopColor="#071c36" />
        </radialGradient>
        <radialGradient id={`${uid}-atmosphere`}>
          <stop offset=".75" stopColor="#61b8e8" stopOpacity="0" />
          <stop offset=".88" stopColor="#77cbea" stopOpacity=".4" />
          <stop offset="1" stopColor="#61b8e8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-blast`}>
          <stop stopColor="#fff" />
          <stop offset=".12" stopColor="#ffe6a1" />
          <stop offset=".4" stopColor="#f3a15a" stopOpacity=".6" />
          <stop offset="1" stopColor="#f0924b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-metal`} x2="0" y2="1">
          <stop stopColor="#c1d2d9" />
          <stop offset=".45" stopColor="#617f91" />
          <stop offset="1" stopColor="#263c50" />
        </linearGradient>
        <filter id={`${uid}-soft`}>
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      <rect width="800" height="500" fill={at("space")} />
      {Array.from({ length: 85 }, (_, i) => (
        <circle
          key={i}
          cx={((i * 137) % 790) + 5}
          cy={((i * 97) % 480) + 10}
          r={i % 9 === 0 ? 1.3 : 0.65}
          fill="#cedde9"
          opacity={0.16 + (i % 5) * 0.1}
        />
      ))}
      <g fontFamily="inherit" fontSize="15" fill="#c5d7e5">
        {signal && (
          <>
            {earth()}
            {sun()}
            {triple()}
            <text x="330" y="322" textAnchor="middle">
              {zh ? "太阳" : "Солнце"}
            </text>
            <path
              d="M148 291L173 265L182 283M173 265L168 292"
              fill="none"
              stroke="#c4dbe7"
              strokeWidth="2"
            />
            {event.visual === "signal" ? (
              <>
                {beam("M156 300L287 260", "#7dceef", phase ? 4 : 1.5)}
                {phase >= 1 && (
                  <>
                    {waves(330, 240, phase + 1)}
                    {beam("M375 218L582 183", "#f5d59d", phase === 2 ? 4 : 1.5)}
                  </>
                )}
                {phase === 2 && waves(639, 210, 2, "#f5d59d")}
              </>
            ) : (
              <>
                {beam(
                  "M590 235L166 313",
                  phase === 2 ? "#e0b976" : "#8cd4eb",
                  2 + phase,
                )}
                {phase >= 1 && waves(120, 325, phase + 1)}
                {phase === 2 && beam("M156 298L580 235", "#edb98a", 3)}
              </>
            )}
          </>
        )}
        {event.visual === "fleet" && !isBattle && (
          <>
            {earth(120, 320)}
            {triple(658, 170)}
            <path
              d="M596 262Q370 395 175 325"
              fill="none"
              stroke="#6a9bb5"
              strokeDasharray="6 9"
            />
            {Array.from({ length: 12 }, (_, i) =>
              ship(
                590 - (i % 4) * 37 - phase * 108,
                290 + Math.floor(i / 4) * 27,
                0.6,
                180,
              ),
            )}
            {phase >= 1 && (
              <>
                {waves(120, 320, 3, "#c4a4ee")}
                <path
                  d="M65 300Q120 230 175 300M65 340Q120 405 175 340M120 269V370M77 280L163 359M77 359L163 280"
                  fill="none"
                  stroke="#b7a8e5"
                  strokeOpacity=".65"
                />
              </>
            )}
          </>
        )}
        {isBattle && (
          <>
            {Array.from({ length: 5 }, (_, i) =>
              ship(
                190 + i * 104,
                235 + (i % 2) * 58,
                1.15,
                i % 2 ? 180 : 0,
                phase === 2 && i !== 4,
              ),
            )}
            {phase === 1 && (
              <g fill="#c7ad78">
                {Array.from({ length: 5 }, (_, i) => (
                  <g key={i}>
                    <rect
                      x={175 + i * 104}
                      y={184 + (i % 2) * 58}
                      width="35"
                      height="5"
                      opacity=".2"
                    />
                    <rect
                      x={175 + i * 104}
                      y={184 + (i % 2) * 58}
                      width={28 - i * 4}
                      height="5"
                    />
                  </g>
                ))}
              </g>
            )}
            {phase === 2 && (
              <>
                {beam("M208 235L476 293", "#ed9c77", 3)}
                {beam("M490 286L620 241", "#8ed6ee", 2)}
                {flash(403, 250, 45)}
              </>
            )}
            {phase === 2 && ship(655, 145, 1.2, -25)}
            <text x="400" y="402" textAnchor="middle">
              {zh
                ? "深空中的人类舰队"
                : "Человеческие корабли в глубоком космосе"}
            </text>
          </>
        )}
        {event.visual === "droplet" && !collapse && (
          <>
            {earth(90, 100, 22)}
            {fleet(phase === 2)}
            {phase >= 1 && (
              <>
                {beam(
                  "M660 125L258 210L547 335L330 340",
                  "#d9f3ff",
                  phase === 1 ? 2 : 1,
                )}
                {flash(
                  phase === 1 ? 405 : 520,
                  phase === 1 ? 250 : 330,
                  phase === 1 ? 15 : 30,
                )}
              </>
            )}
            <g
              transform={`translate(${phase === 0 ? 650 : phase === 1 ? 410 : 315} ${phase === 0 ? 150 : phase === 1 ? 250 : 344}) rotate(135)`}
            >
              <path
                d="M-20 0Q0-20 25 0Q0 20-20 0Z"
                fill={at("metal")}
                stroke="#e9f4ff"
              />
              <circle cx="3" cy="-2" r="2" fill="#fff" />
            </g>
          </>
        )}
        {collapse && (
          <>
            {earth(290, 300, 72)}
            {triple(650, 170)}
            <path
              d="M347 267L585 205"
              stroke="#c6af85"
              strokeWidth="2"
              strokeDasharray="7 12"
              opacity={phase === 2 ? 0.1 : 0.7}
            />
            {[0, 1, 2].map((i) => (
              <g
                key={i}
                transform={`translate(${228 + i * 62} ${204 + (i % 2) * 18})`}
                opacity={phase === 2 ? 0.15 : 1}
              >
                <path
                  d="M-12-9Q0 13 12-9M0 0V22M-7 22H7"
                  fill="none"
                  stroke="#bfd5df"
                  strokeWidth="3"
                />
              </g>
            ))}
            {phase >= 1 && (
              <>
                {beam("M520 110L352 206L230 206", "#dceef6", 2)}
                {flash(phase === 1 ? 350 : 232, 206, phase === 1 ? 18 : 32)}
              </>
            )}
            <path
              d={
                phase === 0
                  ? "M490 122Q510 103 527 121Q508 141 490 122Z"
                  : "M240 204Q259 185 276 203Q257 223 240 204Z"
              }
              fill={at("metal")}
              stroke="#e6f2fa"
            />
          </>
        )}
        {event.visual === "deterrence" && (
          <>
            {earth(155, 315, 50)}
            {triple(640, 185)}
            <path
              d="M199 288L575 226"
              stroke="#c9ad81"
              strokeWidth="2"
              strokeDasharray="9 12"
            />
            <circle
              cx="155"
              cy="315"
              r="85"
              fill="none"
              stroke="#9cd4c4"
              strokeWidth="2"
              strokeDasharray={phase === 0 ? "4 7" : undefined}
            />
            {phase >= 1 && (
              <g stroke="#d7bb81" fill="none">
                <path d="M580 140h-18v18M690 140h18v18M562 238v18h18M708 238v18h-18" />
                <circle cx="636" cy="198" r="42" strokeDasharray="3 7" />
              </g>
            )}
          </>
        )}
        {event.visual === "broadcast" && (
          <>
            {ship(250, 300, 1.7)}
            {ship(390, 245, 1.2, 180)}
            {triple(650, 160)}
            {phase === 0 && (
              <g stroke="#c2ace4" fill="none" opacity=".7">
                <path d="M185 250L290 220L332 315L226 346ZM205 230L310 200L352 295L246 326ZM185 250L205 230M290 220L310 200M332 315L352 295M226 346L246 326" />
              </g>
            )}
            {phase === 1 && (
              <g fill={at("metal")} stroke="#b4ccdc" opacity=".4">
                <ellipse cx="430" cy="315" rx="16" ry="7" />
                <path d="M416 299L444 331M444 299L416 331" />
              </g>
            )}
            {phase === 2 && waves(250, 300, 7)}
            {phase === 2 && (
              <g stroke="#eed6a4" fill="none">
                <circle cx="650" cy="165" r="90" />
                <path d="M650 60V110M650 220V270M545 165H595M705 165H755" />
              </g>
            )}
          </>
        )}
        {event.visual === "photoid" && (
          <>
            {triple(440, 225, phase === 2)}
            {phase < 2 && (
              <>
                {beam(
                  `M760 80L${phase === 0 ? 620 : 420} ${phase === 0 ? 155 : 200}`,
                  "#cceeff",
                  3,
                )}
                <circle
                  cx={phase === 0 ? 620 : 420}
                  cy={phase === 0 ? 155 : 200}
                  r="4"
                  fill="#effbff"
                />
              </>
            )}
            {phase >= 1 && flash(410, 203, phase === 1 ? 43 : 105)}
            {phase === 2 && (
              <g stroke="#efc59b" fill="none" opacity=".5">
                {[110, 145, 180].map((r) => (
                  <ellipse key={r} cx="440" cy="225" rx={r} ry={r * 0.65} />
                ))}
              </g>
            )}
          </>
        )}
        {event.visual === "bunker" && (
          <>
            {sun(150, 185, 45)}
            <g transform="translate(470 300)">
              <ellipse
                rx="166"
                ry="56"
                fill="none"
                stroke="#9a8c75"
                strokeOpacity=".35"
                transform="rotate(-20)"
              />
              <circle r="72" fill={at("red")} />
              <path
                d="M-68-22Q0-4 70-23M-70 5Q0 24 71 4M-65 29Q0 48 64 28"
                stroke="#cbbba3"
                strokeWidth="12"
                opacity=".4"
              />
            </g>
            {Array.from({ length: phase === 0 ? 0 : phase + 1 }, (_, i) => (
              <g
                key={i}
                transform={`translate(${570 + i * 44} ${277 + (i % 2) * 53})`}
              >
                <path d="M-12-15H12V15H-12Z" fill="#8ca7b2" stroke="#d5e5e8" />
                <path d="M-26-8H-12M12 8H26" stroke="#a6cfdf" strokeWidth="4" />
              </g>
            ))}
            <path
              d="M195 205L397 274M195 208L399 322"
              stroke="#e9cf98"
              strokeOpacity=".2"
            />
            <text x="470" y="408" textAnchor="middle">
              {zh ? "巨行星与太空城" : "Планета-гигант и космические города"}
            </text>
          </>
        )}
        {event.visual === "flattening" && (
          <>
            {phase < 2 ? (
              <g
                transform={`translate(390 270) scale(1 ${phase === 1 ? 0.4 : 1})`}
              >
                {sun(0, 0, 45)}
                {[90, 130, 175, 225].map((r, i) => (
                  <g key={r}>
                    <ellipse
                      rx={r}
                      ry={r * 0.6}
                      fill="none"
                      stroke="#d9b884"
                      strokeOpacity=".28"
                    />
                    <circle
                      cx={Math.cos(i * 1.3) * r}
                      cy={Math.sin(i * 1.3) * r * 0.6}
                      r={11 + i * 3}
                      fill={at(i % 2 ? "earth" : "red")}
                    />
                  </g>
                ))}
              </g>
            ) : (
              <g transform="translate(390 294) rotate(-12)">
                <ellipse rx="285" ry="91" fill="#d7a45f" opacity=".12" />
                <ellipse
                  rx="235"
                  ry="59"
                  fill="none"
                  stroke="#efc37c"
                  strokeWidth="2"
                />
                <ellipse rx="100" ry="24" fill={at("sun")} />
                {[150, 190, 230].map((r, i) => (
                  <ellipse
                    key={r}
                    cx={(i - 1) * 130}
                    cy={i % 2 ? 24 : -13}
                    rx="17"
                    ry="5"
                    fill={at(i % 2 ? "earth" : "red")}
                  />
                ))}
              </g>
            )}
            <path
              d={
                phase === 0
                  ? "M680 95l45-12 18 26-45 12Z"
                  : "M465 200l45-12 18 26-45 12Z"
              }
              fill="#d3e8f1"
              fillOpacity=".55"
              stroke="#dff6ff"
            />
            {phase >= 1 && (
              <path
                d="M80 380Q400 185 730 335L730 420Q400 270 80 460Z"
                fill="#d9bf90"
                opacity={phase === 2 ? 0.1 : 0.055}
              />
            )}
          </>
        )}
        {event.visual === "escape" && (
          <>
            {phase === 0 ? (
              sun(170, 290, 57)
            ) : (
              <ellipse
                cx="170"
                cy="320"
                rx="150"
                ry="24"
                fill={at("sun")}
                opacity=".6"
              />
            )}
            {beam(
              `M${phase === 0 ? 265 : 330} 260L${phase === 2 ? 670 : 510} ${phase === 2 ? 120 : 200}`,
              "#8dcce8",
              phase === 2 ? 5 : 2,
            )}
            {ship(
              phase === 0 ? 335 : phase === 1 ? 490 : 680,
              phase === 0 ? 245 : phase === 1 ? 198 : 118,
              phase === 2 ? 0.8 : 1.7,
              -20,
            )}
            {phase === 2 && (
              <path
                d="M335 273Q500 242 710 127"
                stroke="#243c58"
                strokeWidth="42"
                fill="none"
                opacity=".6"
              />
            )}
          </>
        )}
      </g>
      <text x="28" y="470" fill="#9cb1c1" fontFamily="inherit" fontSize="12">
        {zh ? "情节示意 · 不按比例" : "Сюжетная схема · масштаб условный"}
      </text>
      <text
        x="772"
        y="470"
        fill="#c1d2df"
        fontFamily="inherit"
        fontSize="13"
        textAnchor="end"
      >
        {phase + 1} / 3
      </text>
    </svg>
  );
}
