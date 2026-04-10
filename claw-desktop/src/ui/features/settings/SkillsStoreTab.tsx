// Skills Store - pub.dev inspired layout
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import {
  Search,
  Download,
  Loader2,
  Package,
  TrendingUp,
  Trash2,
  AlertCircle,
  ExternalLink,
  Check,
} from 'lucide-react';

interface StoreSkill {
  id: string;
  skill_id: string;
  name: string;
  installs: number;
  source: string;
}

interface InstalledSkill {
  name: string;
  description: string | null;
  path: string;
  source: {
    type: string;
    owner?: string;
    repo?: string;
    path?: string;
  } | null;
}

type ViewMode = 'search' | 'results';

interface SkillsStoreTabProps {
  onBack: () => void;
}

export function SkillsStoreTab({ onBack }: SkillsStoreTabProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState<StoreSkill[]>([]);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [installingSkills, setInstallingSkills] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadInstalled = async () => {
    try {
      const installed = await invoke<InstalledSkill[]>('get_installed_skills', {
        scope: 'global',
        projectDir: null,
      });
      console.log('📦 Loaded installed skills:', installed);
      setInstalledSkills(installed);
    } catch (e) {
      console.error('Failed to load installed skills:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError(t('settings.skills.searchMinLength'));
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const results = await invoke<StoreSkill[]>('search_skills_store', {
        query: searchQuery,
        limit: 50,
      });
      setSkills(results);
      setViewMode('results');
      await loadInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async (skill: StoreSkill) => {
    setInstallingSkills(prev => new Set(prev).add(skill.id));
    setError(null);

    try {
      await invoke('install_skills', {
        request: {
          source_url: skill.source,
          selected_skills: [skill.name],
          target_agents: ['universal'],
          scope: 'global',
          install_mode: 'copy',
        },
        projectDir: null,
      });

      await loadInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallingSkills(prev => {
        const next = new Set(prev);
        next.delete(skill.id);
        return next;
      });
    }
  };

  const handleDelete = async (skill: StoreSkill) => {
    setInstallingSkills(prev => new Set(prev).add(skill.id));
    setError(null);

    try {
      await invoke('uninstall_skills', {
        skillNames: [skill.name],
        targetAgents: ['universal'],
        scope: 'global',
        projectDir: null,
      });

      await loadInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallingSkills(prev => {
        const next = new Set(prev);
        next.delete(skill.id);
        return next;
      });
    }
  };

  const handleOpenGitHub = (source: string) => {
    const githubUrl = source.startsWith('http') 
      ? source 
      : `https://github.com/${source}`;
    open(githubUrl);
  };

  // Check if skill is installed by matching name AND source
  const isInstalled = (skill: StoreSkill) => {
    return installedSkills.some(installed => {
      // Match by name
      if (installed.name !== skill.name) return false;
      
      // Match by source (GitHub repo)
      if (installed.source?.type === 'GitHub') {
        const installedRepo = `${installed.source.owner}/${installed.source.repo}`;
        // skill.source có thể là "owner/repo" hoặc full URL
        const storeRepo = skill.source.replace('https://github.com/', '').replace('.git', '');
        return installedRepo === storeRepo;
      }
      
      // Fallback: chỉ match theo name nếu không có source info
      return true;
    });
  };

  const isProcessing = (skillId: string) => {
    return installingSkills.has(skillId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t('common.back', 'Back to Installed Skills')}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-destructive hover:text-destructive/80 text-sm font-medium"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* Search View - Centered */}
      {viewMode === 'search' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-24">
          <Package className="w-20 h-20 text-muted-foreground/20 mb-8" />
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {t('settings.skills.storeTitle')}
          </h1>
          <p className="text-muted-foreground mb-12 text-center max-w-md">
            {t('settings.skills.storeDescription')}
          </p>

          <div className="w-full max-w-3xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('settings.skills.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-32 py-4 text-base rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('common.search')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results View - Sidebar + List */}
      {viewMode === 'results' && (
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 shrink-0 space-y-6">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('settings.skills.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('settings.skills.results')}
              </h3>
              <p className="text-2xl font-bold text-foreground">
                {skills.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.skills.packagesFound', 'packages found')}
              </p>
            </div>

            {/* Installed Filter */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('settings.skills.status', 'Status')}
              </h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{t('settings.skills.all', 'All')}</span>
                  <span className="text-muted-foreground">{skills.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{t('settings.skills.installed')}</span>
                  <span className="text-muted-foreground">
                    {skills.filter(s => isInstalled(s)).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              skills.map(skill => (
                <div
                  key={skill.id}
                  className="p-4 rounded-lg border border-border bg-card hover:border-accent-foreground/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-foreground">
                          {skill.name}
                        </h3>
                        {isInstalled(skill) && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-500">
                            <Check className="w-3 h-3" />
                            {t('settings.skills.installed')}
                          </span>
                        )}
                      </div>
                      {/* Full ID */}
                      <p className="text-xs text-muted-foreground font-mono mb-2 truncate">
                        {skill.id}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="w-3 h-3" />
                        <span>{skill.installs.toLocaleString()} {t('settings.skills.installs', 'installs')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenGitHub(skill.source)}
                        className="px-3 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted transition-colors"
                        title={t('settings.skills.openGitHub')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      {isInstalled(skill) ? (
                        <button
                          onClick={() => handleDelete(skill)}
                          disabled={isProcessing(skill.id)}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                          {isProcessing(skill.id) ? (
                            <>
                              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                              {t('settings.skills.uninstalling')}
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 inline mr-2" />
                              {t('settings.skills.uninstall')}
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInstall(skill)}
                          disabled={isProcessing(skill.id)}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isProcessing(skill.id) ? (
                            <>
                              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                              {t('settings.skills.installing')}
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 inline mr-2" />
                              {t('settings.skills.install')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
