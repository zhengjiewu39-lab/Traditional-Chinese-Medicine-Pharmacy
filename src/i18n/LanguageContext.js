import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import en from './locales/en';
import zh from './locales/zh';

const STORAGE_KEY = 'app_lang';
const locales = { en, zh };

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'zh' ? saved : 'zh';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next === 'en' ? 'en' : 'zh');
  }, []);

  const t = useCallback(
    (key, vars) => {
      let str = getByPath(locales[lang], key) ?? getByPath(locales.en, key) ?? key;
      if (vars && typeof str === 'string') {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return str;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
