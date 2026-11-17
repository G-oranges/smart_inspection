import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBulkSelection } from "../useBulkSelection";

describe("useBulkSelection", () => {
  it("handles row/page selection and clear", () => {
    const onCleared = vi.fn();
    const { result } = renderHook(() =>
      useBulkSelection({ defaultSelectedIds: ["1"], onCleared })
    );

    act(() => {
      result.current.toggleRow("2");
    });
    expect(result.current.selectedIds).toEqual(["1", "2"]);
    expect(result.current.selectAcrossPages).toBe(false);

    act(() => {
      result.current.toggleRow("1");
    });
    expect(result.current.selectedIds).toEqual(["2"]);

    act(() => {
      result.current.selectPage(["2", "3"]);
    });
    expect(result.current.selectedIds).toEqual(["2", "3"]);

    act(() => {
      result.current.selectAllResults();
    });
    expect(result.current.selectAcrossPages).toBe(true);
    expect(result.current.selectedIds).toEqual([]);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectAcrossPages).toBe(false);
    expect(result.current.selectedIds).toEqual([]);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it("computes selection count for cross-page selection", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => {
      result.current.selectPage(["1", "2"]);
    });
    expect(result.current.getSelectionCount(10)).toBe(2);

    act(() => {
      result.current.selectAllResults();
    });
    expect(result.current.getSelectionCount(10)).toBe(10);
  });
});
