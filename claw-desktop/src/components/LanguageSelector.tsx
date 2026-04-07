import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { CustomDropdown, DropdownOption } from './ui/custom-dropdown';

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const languageOptions: DropdownOption[] = [
    {
      id: 'vi',
      label: t('languages.vi'),
      icon: <span className="text-sm">🇻🇳</span>,
    },
    {
      id: 'en',
      label: t('languages.en'),
      icon: <span className="text-sm">🇺🇸</span>,
    },
  ];

  const handleLanguageChange = (value: string | string[]) => {
    const lang = Array.isArray(value) ? value[0] : value;
    i18n.changeLanguage(lang);
  };

  return (
    <CustomDropdown
      trigger={
        <div className="flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5" />
          <span className="text-xs">{t('sessionList.language')}</span>
        </div>
      }
      options={languageOptions}
      value={i18n.language}
      onChange={handleLanguageChange}
      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-muted transition-colors"
      dropdownClassName="min-w-[160px]"
      align="end"
    />
  );
}
