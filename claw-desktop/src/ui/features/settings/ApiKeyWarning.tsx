// ApiKeyWarning - Reusable component for API key input with link
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';

interface ApiKeyWarningProps {
  messageKey: string; // Translation key for warning message (e.g., "kilo.apiKeyRequired")
  linkTextKey: string; // Translation key for link text (e.g., "kilo.getYourApiKey")
  linkUrl: string; // URL to get API key
  onSave: (apiKey: string) => Promise<void>;
}

export function ApiKeyWarning({ 
  messageKey, 
  linkTextKey, 
  linkUrl, 
  onSave 
}: ApiKeyWarningProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    setSaving(true);
    try {
      await onSave(apiKey.trim());
      setApiKey(''); // Clear input after save
    } catch (error) {
      console.error('Failed to save API key:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-2.5 space-y-2">
      <p className="text-xs text-yellow-600 dark:text-yellow-500">
        {t(messageKey)}
      </p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder={t('settings.apiKey')}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && apiKey.trim()) {
                handleSave();
              }
            }}
            disabled={saving}
            className="h-7 text-xs pr-8"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!apiKey.trim() || saving}
          className="h-7 text-xs px-2"
        >
          {t('common.save')}
        </Button>
      </div>
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t(linkTextKey)}
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
