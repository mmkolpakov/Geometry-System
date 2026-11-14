import { lessons } from "../content/curriculum";
export type View = "systems" | "journey" | "lab" | "library";
export type Lab = "geometry" | "threebody";
export type Geometry = "flat" | "sphere" | "hyperbolic";
export type Preset = "figure-eight" | "triangle" | "chaotic";
export interface Session {
  language: "ru" | "zh-CN";
  view: View;
  lab: Lab;
  system: "solar" | "triple";
  systemTime: number;
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
  view: "systems",
  lab: "geometry",
  system: "solar",
  systemTime: 0,
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
  const systemTime = Number(q.get("time") ?? 0);
  const lessonIndex = Number.isInteger(lesson)
    ? Math.max(0, Math.min(lessons.length - 1, lesson))
    : 0;
  const selected = lessons[lessonIndex];
  const fallbackView = q.has("lesson") ? "journey" : defaults.view;
  const view = has(q.get("view"), ["systems", "journey", "lab", "library"], fallbackView);
  return {
    language: q.get("lang")?.startsWith("zh") ? "zh-CN" : "ru",
    view,
    system: has(q.get("system"), ["solar", "triple"], "solar"),
    systemTime: Number.isFinite(systemTime) ? Math.max(0, Math.min(q.get("system") === "triple" ? 40 : 165, systemTime)) : 0,
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
    system: s.system,
    time: s.systemTime.toFixed(4),
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
/** Stable key shared by persistence and the cross-tab storage listener. */
export const PROGRESS_KEY = "kontur.progress.v1";
const knownLessonIds = new Set(lessons.map((lesson) => lesson.id));

/** Old or edited browser data cannot inflate the six-lesson completion count. */
export function normalizeProgress(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && knownLessonIds.has(id),
          ),
        ),
      ]
    : [];
}

export function readProgress(): string[] {
  try {
    return normalizeProgress(
      JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

/** Merge the latest saved progress so a stale second tab does not erase completed lessons. */
export function saveProgress(ids: string[]): string[] {
  const completed = normalizeProgress([...readProgress(), ...ids]);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed));
  } catch {
    // The current tab still receives its valid progress when persistence is unavailable.
  }
  return completed;
}

/** An explicit reset bypasses merge; an empty value also notifies other open tabs. */
export function clearProgress(): string[] {
  try {
    localStorage.setItem(PROGRESS_KEY, "[]");
  } catch {
    // Reset remains available in the current tab with storage disabled.
  }
  return [];
}
