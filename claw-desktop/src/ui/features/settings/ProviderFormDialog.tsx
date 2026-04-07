// Provider Form Dialog
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider } from '../../../core/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider | null;
  onSave: (provider: Provider) => Promise<void>;
}

interface ValidationErrors {
  id?: string;
  name?: string;
  api_key?: string;
  base_url?: string;
}

export function ProviderFormDialog({ open, onOpenChange, provider, onSave }: ProviderFormDialogProps) {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState<Partial<Provider>>({
    id: '',
    name: '',
    api_key: '',
    base_url: '',
    models: [],
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (provider) {
      setForm(provider);
    } else {
      setForm({ id: '', name: '', api_key: '', base_url: '', models: [] });
    }
    setShowApiKey(false);
    setErrors({});
    setIsSaving(false);
  }, [provider, open]);

  // Auto-focus first input when dialog opens
  useEffect(() => {
    if (open && !provider && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [open, provider]);

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!form.id?.trim()) {
      newErrors.id = 'ID không được để trống';
    } else if (!/^[a-z0-9-_]+$/.test(form.id)) {
      newErrors.id = 'ID chỉ chứa chữ thường, số, dấu gạch ngang và gạch dưới';
    }

    if (!form.name?.trim()) {
      newErrors.name = 'Tên không được để trống';
    }

    if (!form.api_key?.trim()) {
      newErrors.api_key = 'API Key không được để trống';
    }

    if (!form.base_url?.trim()) {
      newErrors.base_url = 'Base URL không được để trống';
    } else {
      try {
        const url = new URL(form.base_url);
        if (!url.protocol.startsWith('http')) {
          newErrors.base_url = 'URL phải bắt đầu với http:// hoặc https://';
        }
      } catch {
        newErrors.base_url = 'URL không hợp lệ';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave(form as Provider);
      onOpenChange(false);
    } catch (error) {
      alert(`${t('common.error')}: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false} onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>
            {provider ? t('settings.editProvider') : t('settings.addProvider')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {t('settings.providerId')}
                {!provider && <span className="text-destructive ml-0.5">*</span>}
              </label>
              <Input
                ref={firstInputRef}
                value={form.id}
                onChange={(e) => {
                  setForm({ ...form, id: e.target.value.toLowerCase() });
                  if (errors.id) setErrors({ ...errors, id: undefined });
                }}
                placeholder="openai"
                className={`h-8 text-xs ${errors.id ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                disabled={!!provider}
              />
              {errors.id && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.id}</span>
                </div>
              )}
              {!provider && !errors.id && (
                <p className="mt-1 text-[10px] text-muted-foreground">Chỉ chữ thường, số, - và _</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {t('settings.providerName')}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="OpenAI"
                className={`h-8 text-xs ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {errors.name && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              {t('settings.apiKey')}
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => {
                  setForm({ ...form, api_key: e.target.value });
                  if (errors.api_key) setErrors({ ...errors, api_key: undefined });
                }}
                placeholder="sk-..."
                className={`h-8 text-xs font-mono pr-8 ${errors.api_key ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showApiKey ? 'Ẩn API key' : 'Hiện API key'}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.api_key && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.api_key}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              {t('settings.baseUrl')}
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              value={form.base_url}
              onChange={(e) => {
                setForm({ ...form, base_url: e.target.value });
                if (errors.base_url) setErrors({ ...errors, base_url: undefined });
              }}
              placeholder="https://api.openai.com/v1"
              className={`h-8 text-xs font-mono ${errors.base_url ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {errors.base_url && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.base_url}</span>
              </div>
            )}
            {!errors.base_url && (
              <p className="mt-1 text-[10px] text-muted-foreground">Ví dụ: https://api.openai.com/v1</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)} 
            className="h-8 text-xs"
            disabled={isSaving}
          >
            {t('common.cancel')}
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave} 
            className="h-8 text-xs"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="animate-pulse">Đang lưu...</span>
            ) : (
              provider ? t('common.save') : t('settings.addProvider')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
