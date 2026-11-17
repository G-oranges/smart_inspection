import type { PropsWithChildren } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { useTableStateCore } from "../useTableStateCore";

const FILTER_KEYS = ["status", "type"];

interface CoreFilters {
  status: string[];
  type: string[];
}

function parseFilters(searchParams: URLSearchParams): CoreFilters {
  return {
    status: searchParams.getAll("status"),
    type: searchParams.getAll("type"),
  };
}

function buildStrategies(
  parseSpy?: (searchParams: URLSearchParams) => CoreFilters,
) {
  return {
    parseFiltersFromUrl: parseSpy || parseFilters,
    serializeFiltersToUrl: (filters: CoreFilters, params: URLSearchParams) => {
      FILTER_KEYS.forEach((key) => {
        const values = filters[key as keyof CoreFilters] || [];
        [...values].sort().forEach((value) => {
          params.append(key, String(value));
        });
      });
    },
    areFiltersEqual: (draft: CoreFilters, applied: CoreFilters) =>
      FILTER_KEYS.every((key) => {
        const left = [...(draft[key as keyof CoreFilters] || [])].map(String).sort();
        const right = [...(applied[key as keyof CoreFilters] || [])].map(String).sort();
        return left.join("|") === right.join("|");
      }),
    generateFiltersKey: (filters: CoreFilters) =>
      FILTER_KEYS.map((key) => {
        const values = [...(filters[key as keyof CoreFilters] || [])].map(String).sort();
        return `${key}:${values.join(",")}`;
      }).join("|"),
    createDefaultFilters: (): CoreFilters => ({
      status: [],
      type: [],
    }),
    cloneFilters: (filters: CoreFilters): CoreFilters => ({
      status: [...(filters.status || [])],
      type: [...(filters.type || [])],
    }),
  };
}

function wrapper({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe("useTableStateCore", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not sync URL or trigger onApply on draft changes", async () => {
    const onApply = vi.fn();
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    const { result } = renderHook(
      () =>
        useTableStateCore(
          { syncUrl: true, onApply },
          buildStrategies()
        ),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });
    replaceSpy.mockClear();

    act(() => {
      result.current.setDraftFilters({ status: ["active"], type: [] });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceSpy).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("apply/reset sync URL only when values change", async () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(
      () => useTableStateCore({ syncUrl: true }, buildStrategies()),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });
    replaceSpy.mockClear();

    act(() => {
      result.current.setDraftFilters({ status: ["active"], type: [] });
    });
    act(() => {
      result.current.applyFilters();
    });

    await waitFor(() =>
      expect(window.location.search).toContain("status=active")
    );
    expect(replaceSpy).toHaveBeenCalledTimes(1);

    replaceSpy.mockClear();
    act(() => {
      result.current.applyFilters();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(replaceSpy).not.toHaveBeenCalled();

    act(() => {
      result.current.resetAll();
    });
    await waitFor(() =>
      expect(window.location.search).not.toContain("status=active")
    );
  });

  it("tracks isDirty between draft and applied", async () => {
    const { result } = renderHook(
      () => useTableStateCore({ syncUrl: true }, buildStrategies()),
      { wrapper }
    );

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setDraftFilters({ status: ["active"], type: [] });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.applyFilters();
    });
    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  it("restores state from back/forward URL changes", async () => {
    const { result } = renderHook(
      () => useTableStateCore({ syncUrl: true }, buildStrategies()),
      { wrapper }
    );

    await waitFor(() => expect(result.current.pagination.current).toBe(1));

    act(() => {
      window.history.pushState({}, "", "/?status=ready&page=2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(result.current.pagination.current).toBe(2));
    expect(result.current.draftFilters.status).toEqual(["ready"]);
    expect(result.current.appliedFilters.status).toEqual(["ready"]);
  });

  it("skips parse on internal URL updates", async () => {
    const parseSpy = vi.fn(parseFilters);
    const strategies = buildStrategies(parseSpy);

    const { result } = renderHook(
      () => useTableStateCore({ syncUrl: true }, strategies),
      { wrapper }
    );

    await waitFor(() => expect(parseSpy).toHaveBeenCalledTimes(2));
    parseSpy.mockClear();

    act(() => {
      result.current.setDraftFilters({ status: ["active"], type: [] });
    });
    act(() => {
      result.current.applyFilters();
    });

    await waitFor(() =>
      expect(window.location.search).toContain("status=active")
    );
    expect(parseSpy).not.toHaveBeenCalled();
  });
});
