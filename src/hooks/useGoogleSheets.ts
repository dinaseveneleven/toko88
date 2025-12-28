import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, ReceiptData } from '@/types/pos';

export function useGoogleSheets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { action: 'getProducts' }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return data.products || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(message);
      console.error('Error fetching products:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTransaction = useCallback(async (receipt: ReceiptData): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { 
          action: 'addTransaction',
          data: { receipt }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(message);
      console.error('Error saving transaction:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStock = useCallback(async (stockUpdates: { id: string; stock: number }[]): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { 
          action: 'updateStock',
          data: { stockUpdates }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update stock';
      setError(message);
      console.error('Error updating stock:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchProducts,
    saveTransaction,
    updateStock,
  };
}
