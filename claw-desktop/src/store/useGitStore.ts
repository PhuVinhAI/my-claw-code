import { create } from 'zustand';

export interface GitFileChange {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  staged: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

interface GitState {
  // Repository info
  currentBranch: string | null;
  branches: GitBranch[];
  
  // Changes
  changes: GitFileChange[];
  stagedChanges: GitFileChange[];
  
  // Status
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadStatus: () => Promise<void>;
  loadBranches: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  discardChanges: (path: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  switchBranch: (branch: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  currentBranch: null,
  branches: [],
  changes: [],
  stagedChanges: [],
  isLoading: false,
  error: null,

  loadStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<{ changes: GitFileChange[]; staged: GitFileChange[] }>('git_status');
      set({ 
        changes: status.changes,
        stagedChanges: status.staged,
        isLoading: false 
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadBranches: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ current: string; branches: GitBranch[] }>('git_branches');
      set({ 
        currentBranch: result.current,
        branches: result.branches 
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  stageFile: async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_stage_file', { path });
      await get().loadStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  unstageFile: async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_unstage_file', { path });
      await get().loadStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  stageAll: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_stage_all');
      await get().loadStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  unstageAll: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_unstage_all');
      await get().loadStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  discardChanges: async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_discard_changes', { path });
      await get().loadStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  commit: async (message: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_commit', { message });
      await get().loadStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  push: async () => {
    set({ isLoading: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_push');
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  pull: async () => {
    set({ isLoading: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_pull');
      await get().loadStatus();
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  switchBranch: async (branch: string) => {
    set({ isLoading: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_switch_branch', { branch });
      await get().loadBranches();
      await get().loadStatus();
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  refresh: async () => {
    await Promise.all([
      get().loadStatus(),
      get().loadBranches(),
    ]);
  },
}));
