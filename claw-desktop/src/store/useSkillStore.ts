// Skill Store - Manage skills state
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Skill, SkillsListResponse, SkillContent, SelectedSkill } from '../core/entities/Skill';

interface SkillStore {
  // State
  skills: Skill[];
  selectedSkills: SelectedSkill[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadSkills: (workspacePath?: string) => Promise<void>;
  loadSkillContent: (skillName: string, workspacePath?: string) => Promise<SkillContent>;
  addSelectedSkill: (skill: SelectedSkill) => void;
  removeSelectedSkill: (skillName: string) => void;
  clearSelectedSkills: () => void;
  clearError: () => void;
  setError: (error: string) => void;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  // Initial state
  skills: [],
  selectedSkills: [],
  isLoading: false,
  error: null,
  
  // Load available skills
  loadSkills: async (workspacePath?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await invoke<SkillsListResponse>('list_skills', {
        workspacePath: workspacePath || null,
      });
      
      set({
        skills: response.skills,
        isLoading: false,
      });
    } catch (error) {
      console.error('[SkillStore] Failed to load skills:', error);
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },
  
  // Load skill content
  loadSkillContent: async (skillName: string, workspacePath?: string) => {
    try {
      const content = await invoke<SkillContent>('load_skill', {
        skillName,
        workspacePath: workspacePath || null,
      });
      
      return content;
    } catch (error) {
      console.error('[SkillStore] Failed to load skill content:', error);
      throw error;
    }
  },
  
  // Add skill to selection
  addSelectedSkill: (skill: SelectedSkill) => {
    const { selectedSkills } = get();
    
    // Don't add duplicates
    if (selectedSkills.some(s => s.name === skill.name)) {
      return;
    }
    
    set({
      selectedSkills: [...selectedSkills, skill],
    });
  },
  
  // Remove skill from selection
  removeSelectedSkill: (skillName: string) => {
    const { selectedSkills } = get();
    
    set({
      selectedSkills: selectedSkills.filter(s => s.name !== skillName),
    });
  },
  
  // Clear all selected skills
  clearSelectedSkills: () => {
    set({ selectedSkills: [] });
  },
  
  // Clear error
  clearError: () => {
    set({ error: null });
  },
  
  // Set error
  setError: (error: string) => {
    set({ error });
  },
}));
