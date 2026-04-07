// Model Form Dialog
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../../../core/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface ModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: Model | null;
  onSave: (model: Model) => Promise<void>;
}

export function ModelFormDialog({ open, onOpenChange, model, onSave }: ModelFormDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<Model>>({ id: '', name: '' });

  useEffect(() => {
    if (model) {
      setForm(model);
    } else {
      setForm({ id: '', name: '' });
    }
  }, [model, open]);

  const handleSave = async () => {
    if (!form.id || !form.name) {
      alert(t('settings.fillAllFields'));
      return;
    }

    try {
      await onSave(form as Model);
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
            {model ? t('settings.editModel') : t('settings.addModel')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">{t('settings.modelId')}</label>
              <Input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="gpt-4"
                className="h-8 text-xs font-mono"
                disabled={!!model}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">{t('settings.modelName')}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="GPT-4"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">{t('settings.maxContext')}</label>
            <Input
              type="number"
              value={form.max_context || ''}
              onChange={(e) => setForm({ ...form, max_context: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="128000"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} className="h-8 text-xs">
            {model ? t('common.save') : t('settings.addModel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
