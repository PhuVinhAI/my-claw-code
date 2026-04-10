// Antigravity Setup Component - For onboarding
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

interface AntigravitySetupComponentProps {
  onTestSuccess: () => void;
}

export function AntigravitySetupComponent({ onTestSuccess }: AntigravitySetupComponentProps) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    setTestError('');

    try {
      // Start server and test connection
      await invoke('start_antigravity_server');
      setTestResult('success');
      onTestSuccess();
    } catch (error) {
      setTestResult('error');
      setTestError(String(error));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Warning */}
      <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <strong>{t('antigravity.warning')}</strong> {t('antigravity.warningText')}
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Hướng dẫn cài đặt</h3>
        <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
          <li>
            {t('antigravity.step1')}
            <code className="block mt-1.5 px-3 py-2 rounded-md bg-muted text-foreground font-mono text-xs">
              npm install -g antigravity-claude-proxy@latest
            </code>
          </li>
          <li>
            {t('antigravity.step2')}
            <code className="block mt-1.5 px-3 py-2 rounded-md bg-muted text-foreground font-mono text-xs">
              antigravity-claude-proxy start
            </code>
          </li>
          <li>
            {t('antigravity.step3')}
            <code className="block mt-1.5 px-3 py-2 rounded-md bg-muted text-foreground font-mono text-xs">
              antigravity-claude-proxy accounts add
            </code>
          </li>
        </ol>
        <a
          href="https://github.com/badrisnarayanan/antigravity-claude-proxy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          {t('antigravity.docs')}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Test Connection */}
      <div className="space-y-2.5">
        <Button
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full h-10 text-sm"
          variant={testResult === 'success' ? 'outline' : 'default'}
        >
          {testing ? t('onboarding.testing') : testResult === 'success' ? t('onboarding.connectionSuccess') : t('onboarding.testConnection')}
          {testResult === 'success' && <CheckCircle className="ml-2 w-4 h-4" />}
        </Button>

        {testResult === 'error' && (
          <div className="px-3 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-800 dark:text-red-300">
                <strong>{t('onboarding.connectionError')}</strong> {testError}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
