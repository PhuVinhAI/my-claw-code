import { create } from 'zustand';

export type RightPanelTab = 'terminal' | 'git' | null;

interface RightPanelState {
  activeTab: RightPanelTab;
  setActiveTab: (tab: RightPanelTab) => void;
  toggleTab: (tab: RightPanelTab) => void;
}

export const useRightPanelStore = create<RightPanelState>((set) => ({
  activeTab: null,
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  toggleTab: (tab) => set((state) => ({
    activeTab: state.activeTab === tab ? null : tab,
  })),
}));
