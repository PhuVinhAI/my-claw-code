// Skills Settings Tab
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../../../store/useSkillStore';
import { useChatStore } from '../../../store';
import { Loader2, BookOpen, AlertCircle, RefreshCw, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Skill } from '../../../core/entities/Skill';

export function SkillsSettingsTab() {
  const { t } = useTranslation();
  const { skills, isLoading, error, loadSkills, loadSkillContent, clearError } = useSkillStore();
  const { workspacePath } = useChatStore();
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSkills(workspacePath || undefined);
  }, [loadSkills, workspacePath]);

  const handleRefresh = () => {
    loadSkills(workspacePath || undefined);
    setExpandedSkill(null);
    setSkillContent({});
    setLoadingContent({});
  };

  const handleSkillToggle = async (skill: Skill) => {
    const skillName = skill.name;
    
    // Toggle expand/collapse
    if (expandedSkill === skillName) {
      setExpandedSkill(null);
      return;
    }
    
    setExpandedSkill(skillName);
    
    // Load content if not already loaded
    if (!skillContent[skillName]) {
      setLoadingContent(prev => ({ ...prev, [skillName]: true }));
      
      try {
        const content = await loadSkillContent(skill.name, workspacePath || undefined);
        setSkillContent(prev => ({ ...prev, [skillName]: content.content }));
      } catch (error) {
        console.error('Failed to load skill content:', error);
        setSkillContent(prev => ({ ...prev, [skillName]: `Error loading skill: ${error}` }));
      } finally {
        setLoadingContent(prev => ({ ...prev, [skillName]: false }));
      }
    }
  };

  const activeSkills = skills.filter(s => !s.shadowed_by);
  const shadowedSkills = skills.filter(s => s.shadowed_by);

  const renderSkillItem = (skill: Skill, isShadowed: boolean = false) => {
    const isExpanded = expandedSkill === skill.name;
    const isLoadingContent = loadingContent[skill.name];
    const content = skillContent[skill.name];

    return (
      <div
        key={skill.name}
        className={cn(
          "rounded-lg border transition-all",
          isShadowed 
            ? "border-border bg-muted/30 opacity-60" 
            : "border-border bg-card hover:border-accent-foreground/20"
        )}
      >
        {/* Skill Header */}
        <button
          onClick={() => !isShadowed && handleSkillToggle(skill)}
          disabled={isShadowed}
          className="w-full flex items-start gap-3 p-4 text-left"
        >
          {/* Expand Icon */}
          <div className="shrink-0 mt-0.5">
            {isShadowed ? (
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          {/* Skill Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-sm font-medium",
                isShadowed ? "text-muted-foreground" : "text-foreground"
              )}>
                {skill.name}
              </span>
              {skill.origin === 'LegacyCommandsDir' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  legacy
                </span>
              )}
            </div>
            
            {skill.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {skill.description}
              </p>
            )}
            
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
              <div className="flex items-center gap-1">
                <Folder className="w-3 h-3" />
                <span>
                  {typeof skill.source === 'object' ? skill.source.label || skill.source.id : skill.source}
                </span>
              </div>
              
              {isShadowed && skill.shadowed_by && (
                <span>
                  {t('settings.skills.shadowedBy', { 
                    source: typeof skill.shadowed_by === 'object' 
                      ? skill.shadowed_by.label || skill.shadowed_by.id 
                      : skill.shadowed_by
                  })}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && !isShadowed && (
          <div className="border-t border-border px-4 pb-4">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : content ? (
              <div className="mt-4">
                <div className="rounded-md bg-muted/30 p-4 border border-border/50">
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                    {content}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t('settings.skills.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('settings.skills.description')}
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive mb-1">
              {t('settings.skills.errorTitle')}
            </p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-destructive hover:text-destructive/80 text-sm font-medium"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Skills List */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Active Skills */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('settings.skills.available')} ({activeSkills.length})
            </h3>

            {activeSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-border">
                <BookOpen className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  {t('settings.skills.noSkills')}
                </p>
                <p className="text-xs text-muted-foreground/70 text-center mt-1">
                  {t('settings.skills.noSkillsHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeSkills.map((skill) => renderSkillItem(skill, false))}
              </div>
            )}
          </div>

          {/* Shadowed Skills */}
          {shadowedSkills.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('settings.skills.shadowed')} ({shadowedSkills.length})
              </h3>
              <div className="space-y-2">
                {shadowedSkills.map((skill) => renderSkillItem(skill, true))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <h4 className="text-sm font-semibold text-foreground mb-2">
          {t('settings.skills.infoTitle')}
        </h4>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• {t('settings.skills.info1')}</li>
          <li>• {t('settings.skills.info2')}</li>
          <li>• {t('settings.skills.info3')}</li>
        </ul>
      </div>
    </div>
  );
}
