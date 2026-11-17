import type { PropsWithChildren } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import dayjs from "dayjs";
import { useResultTableState } from "../useResultTableState";
import {
  RESULT_DEFAULT_SORT,
  RESULT_SORT_VALUES,
} from "../../pages/result/resultSchema";

function wrapper({ children }: PropsWithChildren) {
  return (
  <BrowserRouter>{children}</BrowserRouter>
  );
}

describe("useResultTableState", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("parses dateRange/sort/filters from URL", () => {
    window.history.replaceState(
      {},
      "",
      `/?dateFrom=2024-01-01&dateTo=2024-01-31&sort=${RESULT_SORT_VALUES.SCORE_DESC}&taskId=12`
    );

    const { result } = renderHook(() => useResultTableState(), { wrapper });

    const [start, end] = result.current.draftFilters.dateRange;
    expect(start.format("YYYY-MM-DD")).toBe("2024-01-01");
    expect(end.format("YYYY-MM-DD")).toBe("2024-01-31");
    expect(result.current.appliedFilters.sort).toBe(
      RESULT_SORT_VALUES.SCORE_DESC
    );
    expect(result.current.appliedFilters.taskId).toEqual(["12"]);
  });

  it("serializes dateRange and tracks isDirty via apply", async () => {
    const { result } = renderHook(() => useResultTableState(), { wrapper });

    const dateRange = [dayjs("2024-02-01"), dayjs("2024-02-20")];

    act(() => {
      result.current.setDraftFilters({
        ...result.current.draftFilters,
        dateRange,
        sort: RESULT_SORT_VALUES.SCORE_ASC,
      });
    });

    await waitFor(() => expect(result.current.isDirty).toBe(true));

    act(() => {
      result.current.applyFilters();
    });

    await waitFor(() =>
      expect(window.location.search).toContain("dateFrom=2024-02-01")
    );
    expect(window.location.search).toContain("dateTo=2024-02-20");
    expect(window.location.search).toContain(
      `sort=${RESULT_SORT_VALUES.SCORE_ASC}`
    );
    expect(result.current.isDirty).toBe(false);
  });

  it("skips empty values and default sort/dateRange in URL", async () => {
    const { result } = renderHook(() => useResultTableState(), { wrapper });

    act(() => {
      result.current.setDraftFilters({
        ...result.current.draftFilters,
        taskId: ["", "9"],
        dateRange: [],
        sort: RESULT_DEFAULT_SORT,
      });
    });

    act(() => {
      result.current.applyFilters();
    });

    await waitFor(() =>
      expect(window.location.search).toContain("taskId=9")
    );
    expect(window.location.search).not.toContain("dateFrom=");
    expect(window.location.search).not.toContain("dateTo=");
    expect(window.location.search).not.toContain("sort=");
  });
});
