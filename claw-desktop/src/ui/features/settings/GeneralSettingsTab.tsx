import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Languages } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function GeneralSettingsTab() {
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkSet = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    setIsDark(isDarkSet);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <div className="space-y-6">
      {/* Theme Setting */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {t('settings.general.theme', 'Theme')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('settings.general.themeDescription', 'Choose your preferred color theme')}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (isDark) toggleTheme();
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
              !isDark
                ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Sun className="w-4 h-4" />
            <span className="text-sm font-medium">{t('settings.general.light', 'Light')}</span>
          </button>
          
          <button
            onClick={() => {
              if (!isDark) toggleTheme();
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
              isDark
                ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Moon className="w-4 h-4" />
            <span className="text-sm font-medium">{t('settings.general.dark', 'Dark')}</span>
          </button>
        </div>
      </div>

      {/* Language Setting */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {t('settings.general.language', 'Language')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('settings.general.languageDescription', 'Select your preferred language')}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => changeLanguage('en')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
              i18n.language === 'en'
                ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Languages className="w-4 h-4" />
            <span className="text-sm font-medium">English</span>
          </button>
          
          <button
            onClick={() => changeLanguage('vi')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
              i18n.language === 'vi'
                ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Languages className="w-4 h-4" />
            <span className="text-sm font-medium">Tiếng Việt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
