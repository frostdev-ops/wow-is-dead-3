import { create } from 'zustand';
import type { DraftRelease, TabType, ReleaseEditorState } from '../types/releases';

interface ReleaseStore {
  // Current editing state
  currentDraft: DraftRelease | null;
  editorState: ReleaseEditorState;

  // Auto-save state
  autoSaveTimer: NodeJS.Timeout | null;
  lastSaved: Date | null;

  // Actions
  setCurrentDraft: (draft: DraftRelease | null) => void;
  setCurrentTab: (tab: TabType) => void;
  markUnsaved: () => void;
  markSaved: () => void;
  addValidationError: (tab: TabType, error: string) => void;
  clearValidationErrors: (tab: TabType) => void;

  // Auto-save
  scheduleAutoSave: (callback: () => Promise<void>) => void;
  cancelAutoSave: () => void;
  resetEditor: () => void;
}

const initialEditorState: ReleaseEditorState = {
  currentTab: 'files',
  hasUnsavedChanges: false,
  validationErrors: {
    files: [],
    metadata: [],
    changelog: [],
    review: [],
  },
};

export const useReleaseStore = create<ReleaseStore>((set, get) => ({
  currentDraft: null,
  editorState: initialEditorState,
  autoSaveTimer: null,
  lastSaved: null,

  setCurrentDraft: (draft) => {
    set({ currentDraft: draft, lastSaved: draft ? new Date() : null });
  },

  setCurrentTab: (tab) => {
    set({
      editorState: { ...get().editorState, currentTab: tab },
    });
  },

  markUnsaved: () => {
    set({
      editorState: { ...get().editorState, hasUnsavedChanges: true },
    });
  },

  markSaved: () => {
    set({
      editorState: { ...get().editorState, hasUnsavedChanges: false },
      lastSaved: new Date(),
    });
  },

  addValidationError: (tab, error) => {
    const errors = { ...get().editorState.validationErrors };
    if (!errors[tab].includes(error)) {
      errors[tab].push(error);
      set({
        editorState: { ...get().editorState, validationErrors: errors },
      });
    }
  },

  clearValidationErrors: (tab) => {
    const errors = { ...get().editorState.validationErrors };
    errors[tab] = [];
    set({
      editorState: { ...get().editorState, validationErrors: errors },
    });
  },

  // Performance: Debounced auto-save (1000ms delay to reduce API calls)
  scheduleAutoSave: (callback) => {
    // Mark as having unsaved changes immediately
    get().markUnsaved();

    // Cancel existing timer
    const existingTimer = get().autoSaveTimer;
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new auto-save in 1 second (debounced)
    const timer = setTimeout(async () => {
      await callback();
      get().markSaved();
    }, 1000);

    set({ autoSaveTimer: timer });
  },

  cancelAutoSave: () => {
    const timer = get().autoSaveTimer;
    if (timer) {
      clearTimeout(timer);
      set({ autoSaveTimer: null });
    }
  },

  resetEditor: () => {
    get().cancelAutoSave();
    set({
      currentDraft: null,
      editorState: initialEditorState,
      autoSaveTimer: null,
      lastSaved: null,
    });
  },
}));
