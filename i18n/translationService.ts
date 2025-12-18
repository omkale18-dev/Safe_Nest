import { Translations } from './translations';

// LibreTranslate API configuration (Free, No API Key Required!)
// Use backend proxy (Google Translate) in dev; fall back to public LibreTranslate in native/prod.
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost:3000') || window.location.origin.includes('127.0.0.1:3000'));
const TRANSLATE_API_URL = isLocalDev
  ? '/api/translate'
  : 'https://libretranslate.de/translate';

// Cache for translated strings to avoid repeated API calls
const translationCache: Record<string, Record<string, string>> = {};

export async function translateText(text: string, targetLang: string): Promise<string> {
  // Check cache first
  const cacheKey = `${targetLang}:${text}`;
  if (translationCache[targetLang]?.[text]) {
    return translationCache[targetLang][text];
  }

  try {
    console.log(`[Translate] Translating "${text.substring(0, 30)}..." to ${targetLang}`);
    const response = await fetch(TRANSLATE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Translation API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.translatedText;
    console.log(`[Translate] Result: "${translatedText.substring(0, 30)}..."`);

    // Store in cache
    if (!translationCache[targetLang]) {
      translationCache[targetLang] = {};
    }
    translationCache[targetLang][text] = translatedText;

    // Persist cache to localStorage
    localStorage.setItem('translation_cache', JSON.stringify(translationCache));

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text
  }
}

export async function translateAllStrings(
  baseTranslations: Translations,
  targetLang: string
): Promise<Translations> {
  // For English, return as-is
  if (targetLang === 'en') {
    return baseTranslations;
  }

  // Load cache from localStorage
  const cachedData = localStorage.getItem('translation_cache');
  if (cachedData) {
    try {
      Object.assign(translationCache, JSON.parse(cachedData));
    } catch (e) {
      console.error('Failed to load translation cache');
    }
  }

  const translated: any = {};

  // Translate each field
  for (const [key, value] of Object.entries(baseTranslations)) {
    if (typeof value === 'string') {
      translated[key] = await translateText(value, targetLang);
    }
  }

  return translated as Translations;
}

// Batch translation for better performance
export async function batchTranslate(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  if (targetLang === 'en') {
    return texts;
  }

  try {
    const response = await fetch(TRANSLATE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: texts,
        source: 'en',
        target: targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error('Batch translation failed');
    }

    const data = await response.json();
    const translations = Array.isArray(data.translatedText) 
      ? data.translatedText 
      : [data.translatedText];

    // Cache all translations
    if (!translationCache[targetLang]) {
      translationCache[targetLang] = {};
    }
    texts.forEach((text, i) => {
      translationCache[targetLang][text] = translations[i];
    });
    localStorage.setItem('translation_cache', JSON.stringify(translationCache));

    return translations;
  } catch (error) {
    console.error('Batch translation error:', error);
    return texts; // Fallback to original texts
  }
}

// Preload translations for a language
export async function preloadLanguage(
  baseTranslations: Translations,
  targetLang: string
): Promise<void> {
  if (targetLang === 'en') return;

  const allTexts = Object.values(baseTranslations).filter(v => typeof v === 'string');
  await batchTranslate(allTexts, targetLang);
}
