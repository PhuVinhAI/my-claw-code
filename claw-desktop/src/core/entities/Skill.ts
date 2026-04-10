// Skill Entity
export type DefinitionSource = 
  | 'ProjectClaw'
  | 'ProjectCodex'
  | 'ProjectClaude'
  | 'UserClawConfigHome'
  | 'UserCodexHome'
  | 'UserClaw'
  | 'UserCodex'
  | 'UserClaude';

export interface Skill {
  name: string;
  description?: string;
  source: DefinitionSource | { id: string; label: string }; // Can be enum string or object
  shadowed_by?: DefinitionSource | { id: string; label: string };
  origin: 'SkillsDir' | 'LegacyCommandsDir';
}

export interface SkillsListResponse {
  kind: 'skills';
  action: 'list';
  summary: {
    total: number;
    active: number;
    shadowed: number;
  };
  skills: Skill[];
}

export interface SkillContent {
  name: string;
  path: string;
  content: string;
  description?: string;
}

export interface SelectedSkill {
  name: string;
  description?: string;
}
