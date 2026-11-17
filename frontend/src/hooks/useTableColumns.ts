import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeColumns } from "../utils/tableConfig";

interface TableColumnLike {
  fieldKey: string;
  label?: string;
  visible?: boolean;
  sortable?: boolean;
  order?: number;
  [key: string]: unknown;
}

interface FetchConfigResult<TColumn extends TableColumnLike> {
  config?: TColumn[];
  [key: string]: unknown;
}

interface UseTableColumnsOptions<TColumn extends TableColumnLike> {
  tableKey?: string;
  defaultColumns?: TColumn[];
  fetchConfig?: (tableKey: string) => Promise<FetchConfigResult<TColumn> | null | undefined>;
  saveConfig?: (tableKey: string, columns: TColumn[]) => Promise<unknown>;
}

interface ServiceError {
  message?: string;
}

export function useTableColumns<TColumn extends TableColumnLike>({
  tableKey,
  defaultColumns = [],
  fetchConfig,
  saveConfig,
}: UseTableColumnsOptions<TColumn>) {
  // 使用 ref 稳定化 defaultColumns，防止内联传入导致无限循环
  const defaultColumnsRef = useRef(defaultColumns);
  defaultColumnsRef.current = defaultColumns;

  // 使用 ref 稳定化 fetchConfig/saveConfig，防止内联函数导致 useEffect 无限循环
  const fetchConfigRef = useRef(fetchConfig);
  fetchConfigRef.current = fetchConfig;
  const saveConfigRef = useRef(saveConfig);
  saveConfigRef.current = saveConfig;

  const [columns, setColumns] = useState<TColumn[]>(() =>
    normalizeColumns(defaultColumns, defaultColumns) as TColumn[],
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const currentDefaults = defaultColumnsRef.current;
    const currentFetchConfig = fetchConfigRef.current;
    const load = async () => {
      if (!currentFetchConfig || !tableKey) return;
      setLoading(true);
      setError("");
      try {
        const res = await currentFetchConfig(tableKey);
        const incoming =
          res?.config && Array.isArray(res.config) ? res.config : currentDefaults;
        if (mounted) {
          setColumns(normalizeColumns(incoming, currentDefaults) as TColumn[]);
        }
      } catch (err) {
        if (mounted) {
          setColumns(normalizeColumns(currentDefaults, currentDefaults) as TColumn[]);
          setError((err as ServiceError).message || "加载字段配置失败");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [tableKey]);

  const visibleColumns = useMemo(
    () =>
      [...columns]
        .filter((col) => col.visible !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((col, index) => ({ ...col, order: index })),
    [columns],
  );

  const save = async (nextColumns: TColumn[]) => {
    const normalized = normalizeColumns(nextColumns, defaultColumns) as TColumn[];
    setSaving(true);
    setError("");
    try {
      setColumns(normalized);
      const currentSaveConfig = saveConfigRef.current;
      if (currentSaveConfig && tableKey) {
        await currentSaveConfig(tableKey, normalized);
      }
    } catch (err) {
      setError((err as ServiceError).message || "保存字段配置失败");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    await save(defaultColumns);
  };

  return {
    columns,
    visibleColumns,
    loading,
    saving,
    error,
    save,
    resetToDefault,
    setColumns,
  };
}
