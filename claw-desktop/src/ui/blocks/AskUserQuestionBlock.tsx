// AskUserQuestionBlock — Interactive question/answer UI
import { useState, useEffect } from 'react';
import { MessageCircleQuestion, CheckCircle2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface AskUserQuestionBlockProps {
  question: string;
  options?: string[];
  toolUseId?: string;
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

interface QuestionOutput {
  question: string;
  answer?: string;
  status: 'pending' | 'answered';
  message?: string;
  options?: string[];
}

export function AskUserQuestionBlock({
  question,
  options,
  toolUseId,
  output,
  isError = false,
  isCancelled = false,
}: AskUserQuestionBlockProps) {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse output if available
  let parsedOutput: QuestionOutput | null = null;
  if (output) {
    try {
      parsedOutput = JSON.parse(output);
    } catch {}
  }

  // Check if truly answered
  const isAnswered = parsedOutput && parsedOutput.status === 'answered';
  
  // Show form when: not answered AND not error AND not cancelled
  const showForm = !isAnswered && !isError && !isCancelled;

  // Handle submit
  const handleSubmit = async () => {
    if (!toolUseId || isSubmitting) return;

    let answer: string;
    if (options && selectedOption !== null) {
      answer = options[selectedOption];
    } else {
      answer = textAnswer.trim();
    }

    if (!answer) return;

    setIsSubmitting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('submit_prompt_answer', {
        toolUseId,
        answer,
      });
    } catch (error) {
      console.error('Failed to submit answer:', error);
      setIsSubmitting(false);
    }
  };

  // Auto-focus on text input
  useEffect(() => {
    if (showForm && !options) {
      const input = document.getElementById(`question-input-${toolUseId}`);
      input?.focus();
    }
  }, [showForm, options, toolUseId]);

  return (
    <div className="bg-muted/40 dark:bg-muted/20 rounded-lg p-2 border w-full space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <MessageCircleQuestion className="h-4 w-4 text-blue-500" />
        <span className="font-semibold text-xs">{t('question.title')}</span>
        {isAnswered && (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            {t('question.answered')}
          </span>
        )}
      </div>

      {/* Question Text */}
      <div className="text-xs text-foreground/90">
        {question}
      </div>

      {/* Show answer if already answered */}
      {isAnswered && parsedOutput && parsedOutput.answer && (
        <div className="flex items-start gap-2 p-1.5 rounded-md bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-green-600 dark:text-green-400 font-medium mb-1">
              {t('question.yourAnswer')}:
            </div>
            <div className="text-xs text-foreground/90">
              {parsedOutput.answer}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Form */}
      {showForm && (
        <div className="space-y-1.5">
          {/* Multiple Choice Options */}
          {options && options.length > 0 && (
            <>
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedOption(index)}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full flex items-start gap-2 p-1.5 rounded-md transition-colors text-left',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedOption === index
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'hover:bg-muted/60 dark:hover:bg-muted/30'
                  )}
                >
                  <div
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                      selectedOption === index
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {selectedOption === index && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-xs">{option}</span>
                </button>
              ))}
            </>
          )}

          {/* Free Text Input */}
          {!options && (
            <input
              id={`question-input-${toolUseId}`}
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textAnswer.trim() && !isSubmitting) {
                  handleSubmit();
                }
              }}
              disabled={isSubmitting}
              placeholder={t('question.placeholder')}
              className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (options ? selectedOption === null : !textAnswer.trim())}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'bg-blue-500 hover:bg-blue-600 text-white'
            )}
          >
            <Send className="h-3 w-3" />
            {isSubmitting ? `${t('question.submit')}...` : t('question.submit')}
          </button>
        </div>
      )}

      {/* Error Message */}
      {isError && output && (
        <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1.5 rounded-md border border-red-500/20">
          {output === 'Prompt cancelled by user' ? t('question.cancelledByUser') : output}
        </div>
      )}
    </div>
  );
}
