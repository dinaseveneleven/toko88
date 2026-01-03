import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  public_invoice_base_url: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  qris_image_url: string;
  bulk_price_percentage: string;
}

const CACHE_KEY = 'pos:app_settings_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Module-level cache for instant access across components
let memoryCache: { settings: AppSettings | null; timestamp: number } = {
  settings: null,
  timestamp: 0
};

function getCachedSettings(): AppSettings | null {
  // Try memory cache first
  if (memoryCache.settings && Date.now() - memoryCache.timestamp < CACHE_TTL) {
    return memoryCache.settings;
  }
  
  // Try localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { settings, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        memoryCache = { settings, timestamp };
        return settings;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function saveToCache(settings: AppSettings) {
  const cacheData = { settings, timestamp: Date.now() };
  memoryCache = cacheData;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore storage errors
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(() => getCachedSettings());
  const [loading, setLoading] = useState(!settings);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');
      
      if (error) throw error;
      
      const settingsMap = data?.reduce((acc, item) => {
        acc[item.key as keyof AppSettings] = item.value || '';
        return acc;
      }, {} as AppSettings) || {} as AppSettings;

      // Ensure all fields have defaults
      const fullSettings: AppSettings = {
        public_invoice_base_url: settingsMap.public_invoice_base_url || '',
        store_name: settingsMap.store_name || 'TOKO BESI 88',
        store_address: settingsMap.store_address || '',
        store_phone: settingsMap.store_phone || '',
        bank_name: settingsMap.bank_name || '',
        bank_account_number: settingsMap.bank_account_number || '',
        bank_account_holder: settingsMap.bank_account_holder || '',
        qris_image_url: settingsMap.qris_image_url || '',
        bulk_price_percentage: settingsMap.bulk_price_percentage || '98',
      };

      saveToCache(fullSettings);
      setSettings(fullSettings);
      return fullSettings;
    } catch (err) {
      console.error('Error fetching app settings:', err);
      return settings;
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    // Only fetch if no cache or cache expired
    const cached = getCachedSettings();
    if (!cached) {
      fetchSettings();
    } else {
      setSettings(cached);
      setLoading(false);
      // Fetch fresh data in background
      fetchSettings();
    }
  }, []);

  return {
    settings,
    loading,
    refetch: fetchSettings,
  };
}
