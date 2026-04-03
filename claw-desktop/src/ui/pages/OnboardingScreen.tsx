// Onboarding Screen - First-time setup wizard
import { useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Provider, Model } from '../../core/entities';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Sparkles, ArrowRight, Check } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<Partial<Provider>>({
    id: '',
    name: '',
    api_key: '',
    base_url: '',
    models: [],
  });
  const [model, setModel] = useState<Partial<Model>>({ id: '', name: '' });
  const { addProvider, addModel, setSelectedModel } = useSettingsStore();

  const handleAddProvider = async () => {
    if (!provider.id || !provider.name || !provider.api_key || !provider.base_url) {
      alert('Vui lòng điền đầy đủ thông tin nhà cung cấp');
      return;
    }

    try {
      await addProvider(provider as Provider);
      setStep(2);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleAddModel = async () => {
    if (!model.id || !model.name) {
      alert('Vui lòng điền đầy đủ thông tin mô hình');
      return;
    }

    try {
      await addModel(provider.id!, model as Model);
      setStep(3);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleSelectModel = async () => {
    try {
      await setSelectedModel(provider.id!, model.id!);
      onComplete();
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Chào mừng đến với Claw</h1>
          <p className="text-muted-foreground">
            Hãy cấu hình nhà cung cấp AI để bắt đầu
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Add Provider */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Bước 1: Thêm nhà cung cấp AI</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">ID (ví dụ: openai)</label>
              <Input
                value={provider.id}
                onChange={(e) => setProvider({ ...provider, id: e.target.value })}
                placeholder="openai"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tên hiển thị</label>
              <Input
                value={provider.name}
                onChange={(e) => setProvider({ ...provider, name: e.target.value })}
                placeholder="OpenAI"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <Input
                type="password"
                value={provider.api_key}
                onChange={(e) => setProvider({ ...provider, api_key: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Base URL</label>
              <Input
                value={provider.base_url}
                onChange={(e) => setProvider({ ...provider, base_url: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <Button onClick={handleAddProvider} className="w-full">
              Tiếp theo <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Add Model */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Bước 2: Thêm mô hình AI</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">ID mô hình (ví dụ: gpt-4)</label>
              <Input
                value={model.id}
                onChange={(e) => setModel({ ...model, id: e.target.value })}
                placeholder="gpt-4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tên hiển thị</label>
              <Input
                value={model.name}
                onChange={(e) => setModel({ ...model, name: e.target.value })}
                placeholder="GPT-4"
              />
            </div>

            <Button onClick={handleAddModel} className="w-full">
              Tiếp theo <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Bước 3: Xác nhận</h2>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <span className="font-medium">Nhà cung cấp: {provider.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <span className="font-medium">Mô hình: {model.name}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Bạn có thể thêm nhiều nhà cung cấp và mô hình khác trong phần Cài đặt sau.
            </p>

            <Button onClick={handleSelectModel} className="w-full">
              Hoàn tất <Check className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
