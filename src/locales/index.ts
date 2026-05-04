import { createI18n } from 'vue-i18n';
import enUS from './en-US.json';
import zhCN from './zh-CN.json';

function getStorage(): Storage | null {
  return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage
    : null;
}

const savedLocale = getStorage()?.getItem('app-locale') || 'en-US';

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en-US',
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN,
  },
});

export default i18n;

export const supportedLocales = [
  { label: 'English', value: 'en-US' },
  { label: '中文', value: 'zh-CN' },
] as const;

export function setLocale(locale: string) {
  i18n.global.locale.value = locale as any;
  getStorage()?.setItem('app-locale', locale);
}
