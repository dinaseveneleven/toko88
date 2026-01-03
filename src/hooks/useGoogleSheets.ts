import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, ReceiptData } from '@/types/pos';

type InvokeFnError = any;

async function extractFunctionErrorDetails(fnError: InvokeFnError): Promise<{
  message: string;
  notFoundIds?: string[];
}> {
  const baseMessage =
    (fnError && typeof fnError.message === 'string' && fnError.message) ||
    'Edge Function error';

  try {
    const ctxJson = fnError?.context?.json;
    if (typeof ctxJson === 'function') {
      const body = await ctxJson();
      const notFoundIds = Array.isArray(body?.notFoundIds)
        ? body.notFoundIds.map((x: unknown) => String(x))
        : undefined;
      const message = typeof body?.error === 'string' ? body.error : baseMessage;
      return { message, notFoundIds };
    }

    const ctxText = fnError?.context?.text;
    if (typeof ctxText === 'function') {
      const text = await ctxText();
      if (typeof text === 'string' && text.trim().length > 0) {
        return { message: text };
      }
    }
  } catch {
    // ignore parsing errors
  }

  return { message: baseMessage };
}

export function useGoogleSheets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get cached products for instant display
  const getCachedProducts = useCallback((): Product[] | null => {
    try {
      const cached = localStorage.getItem('pos:products_cache');
      if (cached) {
        const { products, timestamp } = JSON.parse(cached);
        // Cache valid for 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return products;
        }
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  }, []);

  // Save products to cache
  const cacheProducts = useCallback((products: Product[]) => {
    try {
      localStorage.setItem('pos:products_cache', JSON.stringify({
        products,
        timestamp: Date.now()
      }));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: { action: 'getProducts' },
      });

      if (fnError) {
        const details = await extractFunctionErrorDetails(fnError);
        throw new Error(details.message);
      }
      if (data?.error) throw new Error(data.error);

      const products = data.products || [];
      // Cache the fresh products
      cacheProducts(products);
      return products;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(message);
      console.error('Error fetching products:', err);
      // Return cached products on error
      return getCachedProducts() || [];
    } finally {
      setLoading(false);
    }
  }, [cacheProducts, getCachedProducts]);

  const saveTransaction = useCallback(async (receipt: ReceiptData): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: {
          action: 'addTransaction',
          data: { receipt },
        },
      });

      if (fnError) {
        const details = await extractFunctionErrorDetails(fnError);
        throw new Error(details.message);
      }
      if (data?.error) throw new Error(data.error);

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
    console.log('[useGoogleSheets] updateStock called with:', stockUpdates);
    setLoading(true);
    setError(null);

    try {
      console.log('[useGoogleSheets] Invoking sync-google-sheets with action: updateStock');
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: {
          action: 'updateStock',
          data: { stockUpdates },
        },
      });

      console.log('[useGoogleSheets] Response:', { data, fnError });

      if (fnError) {
        const details = await extractFunctionErrorDetails(fnError);
        const suffix = details.notFoundIds?.length
          ? ` (ID tidak ditemukan: ${details.notFoundIds.join(', ')})`
          : '';
        throw new Error(`${details.message}${suffix}`);
      }
      if (data?.error) throw new Error(data.error);

      console.log('[useGoogleSheets] updateStock success');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update stock';
      setError(message);
      console.error('[useGoogleSheets] Error updating stock:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInventory = useCallback(
    async (
      inventoryUpdates: {
        id: string;
        retailPrice?: number;
        bulkPrice?: number;
        purchasePrice?: number;
        stock?: number;
      }[]
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
          body: {
            action: 'updateInventory',
            data: { inventoryUpdates },
          },
        });

        if (fnError) {
          const details = await extractFunctionErrorDetails(fnError);
          const suffix = details.notFoundIds?.length
            ? ` (ID tidak ditemukan: ${details.notFoundIds.join(', ')})`
            : '';
          throw new Error(`${details.message}${suffix}`);
        }
        if (data?.error) throw new Error(data.error);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update inventory';
        setError(message);
        console.error('Error updating inventory:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addProduct = useCallback(
    async (product: {
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
            data: { product },
          },
        });

        if (fnError) {
          const details = await extractFunctionErrorDetails(fnError);
          throw new Error(details.message);
        }
        if (data?.error) throw new Error(data.error);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add product';
        setError(message);
        console.error('Error adding product:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
        body: {
          action: 'deleteProduct',
          data: { productId },
        },
      });

      if (fnError) {
        const details = await extractFunctionErrorDetails(fnError);
        throw new Error(details.message);
      }
      if (data?.error) throw new Error(data.error);

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
        body: { action: 'repairPriceFormat' },
      });

      if (fnError) {
        const details = await extractFunctionErrorDetails(fnError);
        throw new Error(details.message);
      }
      if (data?.error) throw new Error(data.error);

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

  const updateVariantStock = useCallback(
    async (variantUpdates: { productId: string; variantCode: string; stock: number }[]): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
          body: {
            action: 'updateVariantStock',
            data: { variantUpdates },
          },
        });

        if (fnError) {
          const details = await extractFunctionErrorDetails(fnError);
          throw new Error(details.message);
        }
        if (data?.error) throw new Error(data.error);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update variant stock';
        setError(message);
        console.error('Error updating variant stock:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addVariant = useCallback(
    async (productId: string, variantCode: string, variantName: string, stock: number): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
          body: {
            action: 'addVariant',
            data: { productId, variantCode, variantName, stock },
          },
        });

        if (fnError) {
          const details = await extractFunctionErrorDetails(fnError);
          throw new Error(details.message);
        }
        if (data?.error) throw new Error(data.error);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add variant';
        setError(message);
        console.error('Error adding variant:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteVariant = useCallback(
    async (productId: string, variantCode: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('sync-google-sheets', {
          body: {
            action: 'deleteVariant',
            data: { productId, variantCode },
          },
        });

        if (fnError) {
          const details = await extractFunctionErrorDetails(fnError);
          throw new Error(details.message);
        }
        if (data?.error) throw new Error(data.error);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete variant';
        setError(message);
        console.error('Error deleting variant:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    fetchProducts,
    getCachedProducts,
    saveTransaction,
    updateStock,
    updateInventory,
    addProduct,
    deleteProduct,
    repairPriceFormat,
    updateVariantStock,
    addVariant,
    deleteVariant,
  };
}
