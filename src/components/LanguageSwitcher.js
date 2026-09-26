import React from 'react';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageSwitcher({ sx }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <Tooltip title={t('lang.label')}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={lang}
        onChange={(_e, v) => v && setLang(v)}
        sx={{ mr: 1, ...sx }}
      >
        <ToggleButton value="zh" sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.3)', px: 1.2 }}>
          {t('lang.zh')}
        </ToggleButton>
        <ToggleButton value="en" sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.3)', px: 1.2 }}>
          EN
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
}
