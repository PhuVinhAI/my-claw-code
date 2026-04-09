// Progress Indicator - Dots showing current step
import { cn } from '../../../../lib/utils';

interface ProgressIndicatorProps {
  totalSteps: number;
  currentStep: number;
}

export function ProgressIndicator({ totalSteps, currentStep }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-1.5 w-12 rounded-full transition-colors',
            index <= currentStep ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}
