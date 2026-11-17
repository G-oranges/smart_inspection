import type { PropsWithChildren } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { useTableState } from "../useTableState";

function wrapper({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

interface TableFilters extends Record<string, string[]> {
  status: string[];
}

describe("useTableState", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("syncs search term only after apply", async () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ["status"] }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setDraftSearchTerm("  hello  ");
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(window.location.search).not.toContain("search=hello");

    act(() => {
      result.current.applyFilters();
    });

    await waitFor(() =>
      expect(window.location.search).toContain("search=hello")
    );
  });

  it("syncs sort changes to URL", async () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ["status"] }),
      { wrapper }
    );

    act(() => {
      result.current.handleTableChange(
        { current: 1, pageSize: 10 },
        {},
        { field: "name", order: "descend" }
      );
    });

    await waitFor(() =>
      expect(window.location.search).toContain("sortField=name")
    );
    expect(window.location.search).toContain("sortOrder=desc");
  });

  it("skips apply when filters and search are unchanged", async () => {
    const onApply = vi.fn();
    const { result } = renderHook(
      () => useTableState({ filterKeys: ["status"], onApply }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.applyFilters();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("resets sort to default when sorter is cleared", async () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ["status"] }),
      { wrapper }
    );

    act(() => {
      result.current.handleTableChange(
        { current: 1, pageSize: 10 },
        {},
        { field: "name", order: "ascend" }
      );
    });

    await waitFor(() =>
      expect(window.location.search).toContain("sortField=name")
    );

    act(() => {
      result.current.handleTableChange(
        { current: 1, pageSize: 10 },
        {},
        []
      );
    });

    await waitFor(() =>
      expect(window.location.search).not.toContain("sortField=")
    );
    expect(result.current.sortField).toBe("id");
    expect(result.current.sortOrder).toBe("asc");
  });

  it("normalizes filter values and skips empty results", async () => {
    const normalizers = {
      status: (value: unknown) => {
        if (value === "skip") return "";
        return String(value).trim().toUpperCase();
      },
    };

    const { result } = renderHook(
      () => useTableState({ filterKeys: ["status"], normalizers }),
      { wrapper }
    );

    act(() => {
      result.current.setDraftFilters({ status: ["active", "skip"] } as TableFilters);
    });
    act(() => {
      result.current.applyFilters();
    });

    await waitFor(() =>
      expect(window.location.search).toContain("status=ACTIVE")
    );
    expect(window.location.search).not.toContain("status=skip");
    expect(window.location.search).not.toContain("search=");
  });

  it("restores search and sort from back/forward URL changes", async () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ["status"] }),
      { wrapper }
    );

    act(() => {
      window.history.pushState(
        {},
        "",
        "/?search=term&sortField=score&sortOrder=asc"
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() =>
      expect(result.current.draftSearchTerm).toBe("term")
    );
    expect(result.current.appliedSearchTerm).toBe("term");
    expect(result.current.sortField).toBe("score");
    expect(result.current.sortOrder).toBe("asc");
  });
});
