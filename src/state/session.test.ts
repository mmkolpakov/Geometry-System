import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  clearProgress,
  defaults,
  normalizeProgress,
  PROGRESS_KEY,
  readProgress,
  readSession,
  saveProgress,
  sessionQuery,
} from "./session";
describe("share state", () => {
  it("opens the system explorer while preserving old direct lesson links", () => {
    expect(readSession("")).toMatchObject({view:"systems",system:"solar",systemTime:0});
    expect(readSession("?lesson=2")).toMatchObject({view:"journey",lesson:2});
    const state = {...defaults, system:"triple" as const, systemTime:12.3456};
    expect(readSession("?"+sessionQuery(state))).toEqual(state);
    expect(readSession("?view=systems&system=triple&time=1000").systemTime).toBe(40);
  });

  it("round trips a reproducible experiment", () =>
    expect(
      readSession(
        "?" +
          sessionQuery({
            ...defaults,
            view: "lab",
            geometry: "hyperbolic",
            size: 0.6,
            advanced: true,
          }),
      ),
    ).toEqual({
      ...defaults,
      view: "lab",
      geometry: "hyperbolic",
      size: 0.6,
      advanced: true,
    }));
  it("rejects corrupt parameters", () => {
    const s = readSession("?view=bad&geometry=bad&size=NaN&lesson=999");
    expect(s.view).toBe("journey");
    expect(s.size).toBe(0.75);
    expect(s.lesson).toBe(5);
  });
  it("round trips compared trajectories and the selected paused frame", () => {
    const state = {
      ...defaults,
      view: "lab" as const,
      lab: "threebody" as const,
      preset: "chaotic" as const,
      comparisonEnabled: true,
      perturbation: 0.0007,
      sampleIndex: 412,
    };
    expect(readSession("?" + sessionQuery(state))).toEqual(state);
  });
  it("bounds and validates untrusted trajectory parameters", () => {
    expect(readSession("?compare=yes&dv=NaN&frame=Infinity")).toMatchObject({
      comparisonEnabled: false,
      perturbation: 0.0001,
      sampleIndex: 0,
    });
    expect(readSession("?compare=1&dv=100&frame=900")).toMatchObject({
      comparisonEnabled: true,
      perturbation: 0.001,
      sampleIndex: 600,
    });
    expect(readSession("?dv=-3&frame=-10")).toMatchObject({
      perturbation: 0.0001,
      sampleIndex: 0,
    });
  });
  it("keeps a shared lesson attached to its laboratory while permitting parameter experiments", () => {
    expect(
      readSession("?view=journey&lesson=5&lab=geometry&preset=triangle"),
    ).toMatchObject({ lab: "threebody", preset: "triangle" });
    expect(
      readSession("?view=journey&lesson=0&lab=threebody&geometry=sphere"),
    ).toMatchObject({ lab: "geometry", geometry: "sphere" });
    expect(readSession("?view=lab&lesson=0&lab=threebody")).toMatchObject({
      lab: "threebody",
    });
  });
  it("chooses the lesson model when a direct link omits explicit laboratory parameters", () => {
    expect(readSession("?view=journey&lesson=5")).toMatchObject({
      lab: "threebody",
      preset: "chaotic",
    });
    expect(readSession("?view=journey&lesson=1")).toMatchObject({
      lab: "geometry",
      geometry: "sphere",
    });
  });
});

describe("local lesson progress", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("accepts only unique current lesson IDs from stored data", () => {
    data.set(
      PROGRESS_KEY,
      JSON.stringify([
        "straight-path",
        "straight-path",
        "obsolete",
        1,
        null,
        "right-angles",
      ]),
    );
    expect(readProgress()).toEqual(["straight-path", "right-angles"]);
    expect(normalizeProgress({ id: "straight-path" })).toEqual([]);
  });

  it("does not let a stale second writer erase the first tab completion", () => {
    const staleTab = readProgress();
    expect(saveProgress(["straight-path"])).toEqual(["straight-path"]);
    expect(saveProgress([...staleTab, "right-angles"])).toEqual([
      "straight-path",
      "right-angles",
    ]);
    expect(JSON.parse(data.get(PROGRESS_KEY)!)).toEqual([
      "straight-path",
      "right-angles",
    ]);
  });

  it("reset clears stored progress rather than merging it back", () => {
    saveProgress(["straight-path", "right-angles"]);
    expect(clearProgress()).toEqual([]);
    expect(data.get(PROGRESS_KEY)).toBe("[]");
    expect(readProgress()).toEqual([]);
  });

  it("recovers from malformed JSON and preserves in-memory results when storage fails", () => {
    data.set(PROGRESS_KEY, "{invalid json");
    expect(readProgress()).toEqual([]);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem: () => {
        throw new Error("Storage blocked");
      },
    });
    expect(saveProgress(["straight-path", "not-a-lesson"])).toEqual([
      "straight-path",
    ]);
    expect(clearProgress()).toEqual([]);
  });
});
