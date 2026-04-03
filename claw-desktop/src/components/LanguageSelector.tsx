import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { CustomDropdown, DropdownOption } from './ui/custom-dropdown';

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const languageOptions: DropdownOption[] = [
    {
      id: 'vi',
      label: t('languages.vi'),
      icon: <span className="text-base">🇻🇳</span>,
    },
    {
      id: 'en',
      label: t('languages.en'),
      icon: <span className="text-base">🇺🇸</span>,
    },
  ];

  const handleLanguageChange = (value: string | string[]) => {
    const lang = Array.isArray(value) ? value[0] : value;
    i18n.changeLanguage(lang);
  };

  return (
    <CustomDropdown
      trigger={
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4" />
          <span className="hidden sm:inline">{t('sessionList.language')}</span>
        </div>
      }
      options={languageOptions}
      value={i18n.language}
      onChange={handleLanguageChange}
      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
      dropdownClassName="min-w-[180px]"
    />
  );
}
