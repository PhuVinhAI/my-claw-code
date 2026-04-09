// Welcome Step - Step 0
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { t } = useTranslation();

  return (
    <div className="text-center space-y-8">
      <div>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight">
          {t('onboarding.welcome')}
        </h1>
        <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
          {t('onboarding.subtitle')}
        </p>
      </div>

      <div className="max-w-xs mx-auto pt-4">
        <Button 
          onClick={onNext} 
          className="w-full h-11 text-sm" 
          size="lg"
        >
          {t('onboarding.start')}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
