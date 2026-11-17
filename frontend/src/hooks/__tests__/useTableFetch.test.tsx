import React from "react";
import type { PropsWithChildren } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTableFetch } from "../useTableFetch";

interface FetchResult {
  items: string[];
  total: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useTableFetch", () => {
  it("does not loop requests in StrictMode", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const buildParams = vi.fn(() => ({}));
    const wrapper = ({ children }: PropsWithChildren) => (
      <React.StrictMode>{children}</React.StrictMode>
    );

    renderHook(
      () =>
        useTableFetch({
          fetchFn,
          buildParams,
        }),
      { wrapper }
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  });

  it("keeps latest result when earlier request resolves late", async () => {
    const deferreds: Deferred<FetchResult>[] = [];
    const fetchFn = vi.fn((params, opts) => {
      void params;
      void opts;
      const deferred = createDeferred<FetchResult>();
      deferreds.push(deferred);
      return deferred.promise;
    });

    let page = 1;
    const buildParams = () => ({ page });

    const { result, rerender } = renderHook(
      ({ deps }) =>
        useTableFetch({
          fetchFn,
          buildParams,
          deps,
        }),
      { initialProps: { deps: [page] } }
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    page = 2;
    rerender({ deps: [page] });
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));

    await act(async () => {
      deferreds[1].resolve({ items: ["new"], total: 1 });
    });
    await waitFor(() =>
      expect(result.current.data.items).toEqual(["new"])
    );

    await act(async () => {
      deferreds[0].resolve({ items: ["old"], total: 1 });
    });
    expect(result.current.data.items).toEqual(["new"]);
  });

  it("does not update state or callbacks after abort", async () => {
    const deferred = createDeferred<FetchResult>();
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const fetchFn = vi.fn((params, { signal } = {}) => {
      void params;
      if (signal) {
        signal.addEventListener("abort", () => {
          deferred.reject(new Error("aborted"));
        });
      }
      return deferred.promise;
    });

    const { unmount } = renderHook(() =>
      useTableFetch({
        fetchFn,
        buildParams: () => ({}),
        onSuccess,
        onError,
      })
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps previous data while fetching when keepPreviousData is true", async () => {
    const deferreds: Deferred<FetchResult>[] = [];
    const fetchFn = vi.fn(() => {
      const deferred = createDeferred<FetchResult>();
      deferreds.push(deferred);
      return deferred.promise;
    });

    let page = 1;
    const buildParams = () => ({ page });

    const { result, rerender } = renderHook(
      ({ deps }) =>
        useTableFetch({
          fetchFn,
          buildParams,
          deps,
          keepPreviousData: true,
        }),
      { initialProps: { deps: [page] } }
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    await act(async () => {
      deferreds[0].resolve({ items: ["first"], total: 1 });
    });
    await waitFor(() =>
      expect(result.current.data.items).toEqual(["first"])
    );

    page = 2;
    rerender({ deps: [page] });
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));

    expect(result.current.data.items).toEqual(["first"]);

    await act(async () => {
      deferreds[1].resolve({ items: ["second"], total: 1 });
    });
    await waitFor(() =>
      expect(result.current.data.items).toEqual(["second"])
    );
  });

  it("uses latest callbacks from refs without triggering extra fetch", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ items: [], total: 0 });
    let version = 1;
    const initialBuildParams = vi.fn(() => ({ version }));
    const initialOnSuccess = vi.fn();

    const { rerender, result } = renderHook(
      ({ buildParams, onSuccess }) =>
        useTableFetch({
          fetchFn,
          buildParams,
          onSuccess,
        }),
      {
        initialProps: {
          buildParams: initialBuildParams,
          onSuccess: initialOnSuccess,
        },
      }
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    version = 2;
    const nextBuildParams = vi.fn(() => ({ version }));
    const nextOnSuccess = vi.fn();

    rerender({
      buildParams: nextBuildParams,
      onSuccess: nextOnSuccess,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    expect(fetchFn.mock.calls[1][0]).toEqual({ version: 2 });
    expect(nextOnSuccess).toHaveBeenCalled();
  });
});
