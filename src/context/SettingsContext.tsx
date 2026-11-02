import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode } from '../types';
import { getSetting, setSetting } from '../services/db';

interface SettingsContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: string;
  setLanguage: (lang: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [language, setLanguageState] = useState<string>('en');

  useEffect(() => {
    getSetting<ThemeMode>('theme', 'light').then((savedTheme) => {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    });

    getSetting<string>('app_language', 'en').then((savedLang) => {
      setLanguageState(savedLang);
    });
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    setSetting('theme', newTheme);
  };

  const setLanguage = (newLang: string) => {
    setLanguageState(newLang);
    setSetting('app_language', newLang);
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
