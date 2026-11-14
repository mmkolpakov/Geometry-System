import { lessons } from "../content/curriculum";
export type View = "journey" | "lab" | "library";
export type Lab = "geometry" | "threebody";
export type Geometry = "flat" | "sphere" | "hyperbolic";
export type Preset = "figure-eight" | "triangle" | "chaotic";
export interface Session {
  language: "ru" | "zh-CN";
  view: View;
  lab: Lab;
  geometry: Geometry;
  size: number;
  preset: Preset;
  advanced: boolean;
  lesson: number;
  comparisonEnabled: boolean;
  perturbation: number;
  sampleIndex: number;
}
export const defaults: Session = {
  language: "ru",
  view: "journey",
  lab: "geometry",
  geometry: "flat",
  size: 0.75,
  preset: "figure-eight",
  advanced: false,
  lesson: 0,
  comparisonEnabled: false,
  perturbation: 0.0001,
  sampleIndex: 0,
};
const has = <T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback);
export function readSession(search: string): Session {
  const q = new URLSearchParams(search);
  const size = Number(q.get("size") ?? defaults.size);
  const lesson = Number(q.get("lesson") ?? 0);
  const frame = Number(q.get("frame") ?? 0);
  const delta = Number(q.get("dv") ?? 1);
  const lessonIndex = Number.isInteger(lesson)
    ? Math.max(0, Math.min(lessons.length - 1, lesson))
    : 0;
  const selected = lessons[lessonIndex];
  const view = has(q.get("view"), ["journey", "lab", "library"], defaults.view);
  return {
    language: q.get("lang")?.startsWith("zh") ? "zh-CN" : "ru",
    view,
    // A lesson's instructions and quiz must always use its corresponding laboratory.
    lab:
      view === "journey"
        ? selected.lab
        : has(q.get("lab"), ["geometry", "threebody"], selected.lab),
    geometry: has(
      q.get("geometry"),
      ["flat", "sphere", "hyperbolic"],
      selected.geometry ?? defaults.geometry,
    ),
    size: Number.isFinite(size)
      ? Math.max(0.25, Math.min(1, size))
      : defaults.size,
    preset: has(
      q.get("preset"),
      ["figure-eight", "triangle", "chaotic"],
      selected.preset ?? defaults.preset,
    ),
    advanced: q.get("level") === "research",
    lesson: lessonIndex,
    comparisonEnabled: q.get("compare") === "1",
    perturbation: Number.isInteger(delta)
      ? Math.max(1, Math.min(10, delta)) / 10000
      : defaults.perturbation,
    sampleIndex: Number.isInteger(frame)
      ? Math.max(0, Math.min(600, frame))
      : 0,
  };
}
export function sessionQuery(s: Session) {
  return new URLSearchParams({
    v: "1",
    lang: s.language,
    view: s.view,
    lab: s.lab,
    geometry: s.geometry,
    size: s.size.toFixed(2),
    preset: s.preset,
    level: s.advanced ? "research" : "explore",
    lesson: String(s.lesson),
    compare: s.comparisonEnabled ? "1" : "0",
    dv: String(Math.round(s.perturbation * 10000)),
    frame: String(s.sampleIndex),
  }).toString();
}
export function readProgress(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("kontur.progress.v1") ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
export function saveProgress(ids: string[]) {
  try {
    localStorage.setItem("kontur.progress.v1", JSON.stringify(ids));
  } catch {
    /* Learning remains available when browser storage is disabled. */
  }
}
