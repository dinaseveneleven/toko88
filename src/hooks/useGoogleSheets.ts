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

      // Bulk price default is now calculated in the edge function
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

  const updateInventory = useCallback(async (inventoryUpdates: { 
    id: string; 
    retailPrice?: number;
    bulkPrice?: number;
    purchasePrice?: number;
    stock?: number;
  }[]): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { 
          action: 'updateInventory',
          data: { inventoryUpdates }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update inventory';
      setError(message);
      console.error('Error updating inventory:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const addProduct = useCallback(async (product: {
    name: string;
    category: string;
    purchasePrice: number;
    retailPrice: number;
    bulkPrice: number;
    stock: number;
  }): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { 
          action: 'addProduct',
          data: { product }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add product';
      setError(message);
      console.error('Error adding product:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { 
          action: 'deleteProduct',
          data: { productId }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product';
      setError(message);
      console.error('Error deleting product:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const repairPriceFormat = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { action: 'repairPriceFormat' }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to repair price format';
      setError(message);
      console.error('Error repairing price format:', err);
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
    updateInventory,
    addProduct,
    deleteProduct,
    repairPriceFormat,
  };
}
