import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, Translations, baseTranslations, languageMap, buildStaticTranslations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('safenest_language') as Language | null;
    return saved === 'hi' || saved === 'mr' || saved === 'en' ? saved : 'en';
  });

  const [translations, setTranslations] = useState<Translations>(baseTranslations);
  const [isLoading, setIsLoading] = useState(false);

  const setLanguage = (lang: Language) => {
    const target = lang === 'hi' || lang === 'mr' || lang === 'en' ? lang : 'en';
    setLanguageState(target);
    localStorage.setItem('safenest_language', target);
    const translated = buildStaticTranslations(target as 'en' | 'hi' | 'mr');
    setTranslations(translated);
    setIsLoading(false);
  };

  useEffect(() => {
    setLanguage(language);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
