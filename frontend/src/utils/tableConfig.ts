interface ColumnLike {
  fieldKey: string;
  label?: string;
  visible?: boolean;
  sortable?: boolean;
  order?: number;
  [key: string]: unknown;
}

export function normalizeColumns(
  inputColumns: ColumnLike[] = [],
  defaultColumns: ColumnLike[] = [],
): ColumnLike[] {
  const defaultMap = new Map(
    defaultColumns.map((col, index) => [
      col.fieldKey,
      {
        ...col,
        label: col.label || col.fieldKey,
        visible: col.visible !== false,
        sortable: Boolean(col.sortable),
        order: col.order ?? index,
      },
    ]),
  );

  const merged = inputColumns
    .filter((item) => item && item.fieldKey && defaultMap.has(item.fieldKey))
    .map((item) => {
      const defaultColumn = defaultMap.get(item.fieldKey)!;
      return {
        ...defaultColumn,
        ...item,
        label: item.label || defaultColumn.label,
        visible: item.visible !== false,
        sortable: Boolean(item.sortable ?? defaultColumn.sortable),
      };
    });

  // Ensure defaults are present even if not in input
  defaultMap.forEach((col) => {
    if (!merged.find((item) => item.fieldKey === col.fieldKey)) {
      merged.push(col);
    }
  });

  return merged
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((col, index) => ({ ...col, order: index }));
}
