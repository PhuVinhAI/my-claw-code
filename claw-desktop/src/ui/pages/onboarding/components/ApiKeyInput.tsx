// API Key Input - Reusable input with show/hide toggle
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../../components/ui/input';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  linkUrl?: string;
  linkText?: string;
}

export function ApiKeyInput({ 
  value, 
  onChange, 
  placeholder,
  linkUrl,
  linkText 
}: ApiKeyInputProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          placeholder={placeholder || t('settings.apiKey')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-sm pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {linkUrl && linkText && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {linkText}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
