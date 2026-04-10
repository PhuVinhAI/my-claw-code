// Skills Store Tab - Shop-like UI for browsing and installing skills
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import {
  Search,
  Download,
  Check,
  Loader2,
  Package,
  TrendingUp,
  RefreshCw,
  Settings,
  Trash2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

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
  version: string | null;
  author: string | null;
  tags: string[];
  category: string | null;
  path: string;
  source: any;
  installed: boolean;
  install_date: string | null;
}

interface AgentInfo {
  id: string;
  name: string;
  skills_path: string;
  installed: boolean;
  universal: boolean;
}

type TabType = 'browse' | 'installed' | 'agents';

export function SkillsStoreTab() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [storeSkills, setStoreSkills] = useState<StoreSkill[]>([]);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingSkills, setInstallingSkills] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    loadAgents();
    if (activeTab === 'browse') {
      loadStoreCatalog();
    } else if (activeTab === 'installed') {
      loadInstalledSkills();
    }
  }, [activeTab]);

  const loadStoreCatalog = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const skills = await invoke<StoreSkill[]>('get_skills_catalog', {
        limit: 100,
        offset: 0,
      });
      setStoreSkills(skills);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const loadInstalledSkills = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const skills = await invoke<InstalledSkill[]>('get_installed_skills', {
        scope: 'global',
        projectDir: null,
      });
      setInstalledSkills(skills);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const allAgents = await invoke<AgentInfo[]>('get_supported_agents');
      const detectedIds = await invoke<string[]>('detect_installed_agents');
      
      const agentsWithStatus = allAgents.map(agent => ({
        ...agent,
        installed: detectedIds.includes(agent.id),
      }));
      
      setAgents(agentsWithStatus);
      
      // Auto-select installed agents
      setSelectedAgents(detectedIds);
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadStoreCatalog();
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const skills = await invoke<StoreSkill[]>('search_skills_store', {
        query: searchQuery,
        limit: 50,
      });
      setStoreSkills(skills);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallSkill = async (skill: StoreSkill) => {
    if (selectedAgents.length === 0) {
      setError(t('settings.skills.selectAgentsFirst', 'Please select at least one agent'));
      return;
    }

    setInstallingSkills(prev => new Set(prev).add(skill.name));
    setError(null);

    try {
      const result = await invoke('install_skills', {
        request: {
          source_url: skill.source,
          selected_skills: [skill.name],
          target_agents: selectedAgents,
          scope: 'global',
          install_mode: 'symlink',
        },
        projectDir: null,
      });

      console.log('Install result:', result);
      
      // Reload installed skills
      if (activeTab === 'installed') {
        await loadInstalledSkills();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallingSkills(prev => {
        const next = new Set(prev);
        next.delete(skill.name);
        return next;
      });
    }
  };

  const handleUninstallSkill = async (skill: InstalledSkill) => {
    setInstallingSkills(prev => new Set(prev).add(skill.name));
    setError(null);

    try {
      await invoke('uninstall_skills', {
        skillNames: [skill.name],
        targetAgents: selectedAgents,
        scope: 'global',
        projectDir: null,
      });

      // Reload installed skills
      await loadInstalledSkills();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallingSkills(prev => {
        const next = new Set(prev);
        next.delete(skill.name);
        return next;
      });
    }
  };

  const isSkillInstalled = (skillName: string) => {
    return installedSkills.some(s => s.name === skillName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t('settings.skills.store', 'Skills Store')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.skills.storeDescription', 'Browse and install AI skills for your agents')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('browse')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'browse'
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="w-4 h-4 inline mr-2" />
          {t('settings.skills.browse', 'Browse')}
          {activeTab === 'browse' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('installed')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'installed'
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CheckCircle2 className="w-4 h-4 inline mr-2" />
          {t('settings.skills.installed', 'Installed')}
          {installedSkills.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
              {installedSkills.length}
            </span>
          )}
          {activeTab === 'installed' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('agents')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'agents'
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          {t('settings.skills.agents', 'Agents')}
          {activeTab === 'agents' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive mb-1">
              {t('common.error', 'Error')}
            </p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-destructive hover:text-destructive/80 text-sm font-medium"
          >
            {t('common.dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('settings.skills.searchPlaceholder', 'Search skills...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('common.search', 'Search')}
            </button>
            <button
              onClick={loadStoreCatalog}
              className="px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Agent Selection */}
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-sm font-medium text-foreground mb-3">
              {t('settings.skills.installTo', 'Install to:')}
            </p>
            <div className="flex flex-wrap gap-2">
              {agents.filter(a => a.installed).map(agent => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgents(prev =>
                      prev.includes(agent.id)
                        ? prev.filter(id => id !== agent.id)
                        : [...prev, agent.id]
                    );
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    selectedAgents.includes(agent.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border hover:bg-muted"
                  )}
                >
                  {selectedAgents.includes(agent.id) && (
                    <Check className="w-3 h-3 inline mr-1.5" />
                  )}
                  {agent.name}
                </button>
              ))}
            </div>
          </div>

          {/* Skills Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeSkills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isInstalled={isSkillInstalled(skill.name)}
                  isInstalling={installingSkills.has(skill.name)}
                  onInstall={() => handleInstallSkill(skill)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Installed Tab */}
      {activeTab === 'installed' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : installedSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-border">
              <Package className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                {t('settings.skills.noInstalled', 'No skills installed yet')}
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
              >
                {t('settings.skills.browseCatalog', 'Browse Catalog')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {installedSkills.map(skill => (
                <InstalledSkillItem
                  key={skill.name}
                  skill={skill}
                  isUninstalling={installingSkills.has(skill.name)}
                  onUninstall={() => handleUninstallSkill(skill)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="space-y-2">
            {agents.map(agent => (
              <AgentItem key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Skill Card Component
function SkillCard({
  skill,
  isInstalled,
  isInstalling,
  onInstall,
}: {
  skill: StoreSkill;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:border-accent-foreground/20 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {skill.name}
          </h3>
          <span className="text-xs text-muted-foreground">{skill.source}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          <span>{skill.installs.toLocaleString()}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2.5rem]">
        {t('settings.skills.noDescription', 'No description')}
      </p>

      <button
        onClick={onInstall}
        disabled={isInstalled || isInstalling}
        className={cn(
          "w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isInstalled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : isInstalling
            ? "bg-primary/50 text-primary-foreground cursor-wait"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isInstalling ? (
          <>
            <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
            {t('settings.skills.installing', 'Installing...')}
          </>
        ) : isInstalled ? (
          <>
            <Check className="w-4 h-4 inline mr-2" />
            {t('settings.skills.installed', 'Installed')}
          </>
        ) : (
          <>
            <Download className="w-4 h-4 inline mr-2" />
            {t('settings.skills.install', 'Install')}
          </>
        )}
      </button>
    </div>
  );
}

// Installed Skill Item Component
function InstalledSkillItem({
  skill,
  isUninstalling,
  onUninstall,
}: {
  skill: InstalledSkill;
  isUninstalling: boolean;
  onUninstall: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">
              {skill.name}
            </h3>
            {skill.description && (
              <p className="text-xs text-muted-foreground truncate">
                {skill.description}
              </p>
            )}
          </div>
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {skill.version && (
            <div className="text-xs">
              <span className="text-muted-foreground">{t('settings.skills.version', 'Version')}:</span>
              <span className="ml-2 text-foreground">{skill.version}</span>
            </div>
          )}
          
          {skill.author && (
            <div className="text-xs">
              <span className="text-muted-foreground">{t('settings.skills.author', 'Author')}:</span>
              <span className="ml-2 text-foreground">{skill.author}</span>
            </div>
          )}

          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skill.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={onUninstall}
            disabled={isUninstalling}
            className="w-full px-3 py-2 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            {isUninstalling ? (
              <>
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                {t('settings.skills.uninstalling', 'Uninstalling...')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 inline mr-2" />
                {t('settings.skills.uninstall', 'Uninstall')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Agent Item Component
function AgentItem({ agent }: { agent: AgentInfo }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              agent.installed ? "bg-green-500" : "bg-muted-foreground"
            )}
          />
          <div>
            <h3 className="text-sm font-medium text-foreground">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.skills_path}</p>
          </div>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded",
            agent.installed
              ? "bg-green-500/10 text-green-500"
              : "bg-muted text-muted-foreground"
          )}
        >
          {agent.installed
            ? t('settings.skills.detected', 'Detected')
            : t('settings.skills.notInstalled', 'Not Installed')}
        </span>
      </div>
    </div>
  );
}
