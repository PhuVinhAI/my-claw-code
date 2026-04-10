// Skill Selector Component - Dropdown to select skills
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../../store/useSkillStore';
import { useChatStore } from '../../store';
import { BookOpen } from 'lucide-react';
import { CustomDropdown, type DropdownOption } from '../../components/ui/custom-dropdown';
import type { Skill } from '../../core/entities/Skill';

interface SkillSelectorProps {
  onSelect: (skill: Skill) => void;
}

export function SkillSelector({ onSelect }: SkillSelectorProps) {
  const { t } = useTranslation();
  const { skills, isLoading, loadSkills } = useSkillStore();
  const { workspacePath } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSkills(workspacePath || undefined);
  }, [loadSkills, workspacePath]);

  const activeSkills = skills.filter(s => !s.shadowed_by);
  
  const filteredSkills = searchQuery.trim()
    ? activeSkills.filter(skill =>
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeSkills;

  // Convert skills to dropdown options
  const options: DropdownOption[] = filteredSkills.map(skill => ({
    id: skill.name,
    label: skill.name,
    description: skill.description,
    icon: <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />,
    group: skill.origin === 'LegacyCommandsDir' ? 'Legacy' : 'Skills',
  }));

  const handleSelect = (skillName: string | string[]) => {
    if (typeof skillName === 'string') {
      const skill = activeSkills.find(s => s.name === skillName);
      if (skill) {
        onSelect(skill);
      }
    }
  };

  if (isLoading) {
    return (
      <button
        disabled
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground cursor-not-allowed"
      >
        <BookOpen className="h-3 w-3 animate-pulse" />
        <span>{t('skills.loading')}</span>
      </button>
    );
  }

  return (
    <CustomDropdown
      trigger={t('skills.skill')}
      options={options}
      onChange={handleSelect}
      searchTerm={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t('skills.searchPlaceholder')}
      noModelsFoundLabel={searchQuery.trim() ? t('skills.noResults') : t('skills.noSkills')}
      dropdownClassName="max-w-[360px] max-h-[400px]"
      align="start"
    />
  );
}
