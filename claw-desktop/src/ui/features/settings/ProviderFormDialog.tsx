// Provider Form Dialog
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider } from '../../../core/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider | null;
  onSave: (provider: Provider) => Promise<void>;
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

  useEffect(() => {
    if (provider) {
      setForm(provider);
    } else {
      setForm({ id: '', name: '', api_key: '', base_url: '', models: [] });
    }
    setShowApiKey(false);
  }, [provider, open]);

  const handleSave = async () => {
    if (!form.id || !form.name || !form.api_key || !form.base_url) {
      alert(t('settings.fillAllFields'));
      return;
    }

    try {
      await onSave(form as Provider);
      onOpenChange(false);
    } catch (error) {
      alert(`${t('common.error')}: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {provider ? t('settings.editProvider') : t('settings.addProvider')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">{t('settings.providerId')}</label>
              <Input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="openai"
                className="h-8 text-xs"
                disabled={!!provider}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">{t('settings.providerName')}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="OpenAI"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">{t('settings.apiKey')}</label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="sk-..."
                className="h-8 text-xs font-mono pr-8"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">{t('settings.baseUrl')}</label>
            <Input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} className="h-8 text-xs">
            {provider ? t('common.save') : t('settings.addProvider')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
