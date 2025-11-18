// Bulk operations utility functions

export interface BulkSelection {
  selected: Set<string>;
  selectAll: boolean;
}

export function initBulkSelection(): BulkSelection {
  return {
    selected: new Set(),
    selectAll: false,
  };
}

export function toggleSelection(
  selection: BulkSelection,
  id: string
): BulkSelection {
  const newSelected = new Set(selection.selected);

  if (newSelected.has(id)) {
    newSelected.delete(id);
  } else {
    newSelected.add(id);
  }

  return {
    ...selection,
    selected: newSelected,
    selectAll: false,
  };
}

export function toggleSelectAll(
  selection: BulkSelection,
  allIds: string[]
): BulkSelection {
  if (selection.selectAll) {
    return {
      selected: new Set(),
      selectAll: false,
    };
  } else {
    return {
      selected: new Set(allIds),
      selectAll: true,
    };
  }
}

export function selectRange(
  selection: BulkSelection,
  items: any[],
  startIndex: number,
  endIndex: number
): BulkSelection {
  const newSelected = new Set(selection.selected);
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  for (let i = start; i <= end; i++) {
    if (items[i] && items[i].id) {
      newSelected.add(items[i].id);
    }
  }

  return {
    ...selection,
    selected: newSelected,
    selectAll: false,
  };
}

export function clearSelection(): BulkSelection {
  return {
    selected: new Set(),
    selectAll: false,
  };
}

export function getSelectedCount(selection: BulkSelection): number {
  return selection.selected.size;
}

export function isSelected(selection: BulkSelection, id: string): boolean {
  return selection.selected.has(id);
}

export function getSelectedItems<T extends { id: string }>(
  selection: BulkSelection,
  allItems: T[]
): T[] {
  return allItems.filter(item => selection.selected.has(item.id));
}

// Bulk delete with confirmation
export async function bulkDelete(
  items: { id: string; name?: string }[],
  deleteFunction: (id: string) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const count = items.length;
  const itemsText = items.map(i => i.name || i.id).slice(0, 5).join(', ');
  const extraText = count > 5 ? ` and ${count - 5} more` : '';

  const confirmed = confirm(
    `Delete ${count} item${count !== 1 ? 's' : ''}?\n\n${itemsText}${extraText}\n\nThis action cannot be undone.`
  );

  if (!confirmed) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await deleteFunction(item.id);
      success++;
    } catch (error) {
      console.error(`Failed to delete ${item.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
