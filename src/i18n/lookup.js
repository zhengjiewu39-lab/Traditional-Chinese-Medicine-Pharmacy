import en from './locales/en';
import zh from './locales/zh';

const locales = { en, zh };

export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
}

export function currentLang() {
  return localStorage.getItem('app_lang') === 'en' ? 'en' : 'zh';
}

export function translate(lang, key, vars) {
  let str = getByPath(locales[lang], key) ?? getByPath(locales.en, key);
  if (str == null) return key;
  if (vars && typeof str === 'string') {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}

export function isChineseText(s) {
  return typeof s === 'string' && /[\u4e00-\u9fff]/.test(s);
}

export function meansNoAllergy(s) {
  const v = String(s || '').trim().toLowerCase();
  return v === '无' || v === 'none' || v === 'n/a' || v === 'no';
}
