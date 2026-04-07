// Model Form Dialog
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../../../core/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { AlertCircle } from 'lucide-react';

interface ModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: Model | null;
  onSave: (model: Model) => Promise<void>;
}

interface ValidationErrors {
  id?: string;
  name?: string;
  max_context?: string;
}

export function ModelFormDialog({ open, onOpenChange, model, onSave }: ModelFormDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<Model>>({ id: '', name: '' });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (model) {
      setForm(model);
    } else {
      setForm({ id: '', name: '' });
    }
    setErrors({});
    setIsSaving(false);
  }, [model, open]);

  // Auto-focus first input when dialog opens
  useEffect(() => {
    if (open && !model && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [open, model]);

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!form.id?.trim()) {
      newErrors.id = 'ID không được để trống';
    }

    if (!form.name?.trim()) {
      newErrors.name = 'Tên không được để trống';
    }

    if (form.max_context !== undefined && form.max_context !== null) {
      const maxContext = Number(form.max_context);
      if (isNaN(maxContext) || maxContext <= 0) {
        newErrors.max_context = 'Context phải là số dương';
      } else if (maxContext < 1000) {
        newErrors.max_context = 'Context tối thiểu 1000 tokens';
      } else if (maxContext > 10000000) {
        newErrors.max_context = 'Context tối đa 10M tokens';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave(form as Model);
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
            {model ? t('settings.editModel') : t('settings.addModel')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {t('settings.modelId')}
                {!model && <span className="text-destructive ml-0.5">*</span>}
              </label>
              <Input
                ref={firstInputRef}
                value={form.id}
                onChange={(e) => {
                  setForm({ ...form, id: e.target.value });
                  if (errors.id) setErrors({ ...errors, id: undefined });
                }}
                placeholder="gpt-4"
                className={`h-8 text-xs font-mono ${errors.id ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                disabled={!!model}
              />
              {errors.id && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.id}</span>
                </div>
              )}
              {!model && !errors.id && (
                <p className="mt-1 text-[10px] text-muted-foreground">ID từ provider</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {t('settings.modelName')}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="GPT-4"
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
              {t('settings.maxContext')}
            </label>
            <Input
              type="number"
              value={form.max_context || ''}
              onChange={(e) => {
                setForm({ ...form, max_context: e.target.value ? parseInt(e.target.value) : undefined });
                if (errors.max_context) setErrors({ ...errors, max_context: undefined });
              }}
              placeholder="128000"
              className={`h-8 text-xs ${errors.max_context ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              min="1000"
              max="10000000"
              step="1000"
            />
            {errors.max_context && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.max_context}</span>
              </div>
            )}
            {!errors.max_context && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Số tokens tối đa (ví dụ: 128000 = 128K)
              </p>
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
              model ? t('common.save') : t('settings.addModel')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
