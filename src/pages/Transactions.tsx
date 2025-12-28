import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Receipt } from '@/components/pos/Receipt';
import { ArrowLeft, Search, MessageCircle, Eye, RefreshCw, Loader2 } from 'lucide-react';
import logo88 from '@/assets/logo-88.png';
import { Json } from '@/integrations/supabase/types';
import { ReceiptData, CartItem } from '@/types/pos';

interface Transaction {
  id: string;
  created_at: string;
  items: Json;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  cash_received: number | null;
  change: number | null;
  customer_phone: string | null;
  customer_name: string | null;
  cashier: string | null;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

export default function Transactions() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchTransactions();
  }, [isAuthenticated, navigate]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat riwayat transaksi',
        variant: 'destructive',
      });
    } else {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  };

  const handleResendWhatsApp = async (transaction: Transaction) => {
    if (!transaction.customer_phone) {
      toast({
        title: 'Tidak ada nomor WhatsApp',
        description: 'Transaksi ini tidak memiliki nomor telepon pelanggan',
        variant: 'destructive',
      });
      return;
    }

    setSendingWhatsApp(transaction.id);

    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-invoice', {
        body: {
          invoiceId: transaction.id,
          phone: transaction.customer_phone,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'WhatsApp terkirim!',
        description: `Struk dikirim ke ${transaction.customer_phone}`,
      });
    } catch (err) {
      console.error('WhatsApp send error:', err);
      toast({
        title: 'Gagal kirim WhatsApp',
        description: 'Coba lagi nanti',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsApp(null);
    }
  };

  const handleViewDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailOpen(true);
  };

  const filteredTransactions = transactions.filter((t) => {
    const searchLower = search.toLowerCase();
    return (
      t.id.toLowerCase().includes(searchLower) ||
      t.customer_name?.toLowerCase().includes(searchLower) ||
      t.customer_phone?.includes(search)
    );
  });

  const convertToReceiptData = (t: Transaction): ReceiptData => {
    // Parse items from JSON - cast through unknown for safety
    const items = (Array.isArray(t.items) ? t.items : []) as unknown as CartItem[];
    
    return {
      id: t.id,
      timestamp: new Date(t.created_at),
      items,
      subtotal: t.subtotal,
      discount: t.discount,
      total: t.total,
      paymentMethod: t.payment_method,
      cashReceived: t.cash_received || undefined,
      change: t.change || undefined,
      customerPhone: t.customer_phone || undefined,
      customerName: t.customer_name || undefined,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <img src={logo88} alt="Toko 88" className="h-10 w-auto rounded-lg" />
                <div>
                  <h1 className="font-bold text-xl">Riwayat Transaksi</h1>
                  <p className="text-xs text-muted-foreground">Lihat dan kirim ulang struk</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTransactions}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>Transaksi Terbaru</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari ID, nama, atau telepon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Tidak ada transaksi ditemukan</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Transaksi</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Pembayaran</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">
                            {t.id.slice(0, 20)}...
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(t.created_at).toLocaleDateString('id-ID')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleTimeString('id-ID')}
                            </div>
                          </TableCell>
                          <TableCell>
                            {t.customer_name || t.customer_phone || '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatRupiah(t.total)}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">{t.payment_method}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewDetail(t)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {t.customer_phone && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleResendWhatsApp(t)}
                                  disabled={sendingWhatsApp === t.id}
                                  className="text-green-500 hover:text-green-600"
                                >
                                  {sendingWhatsApp === t.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <MessageCircle className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredTransactions.map((t) => (
                    <div 
                      key={t.id} 
                      className="bg-muted/30 rounded-lg p-3 border border-border"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-primary text-lg">
                            {formatRupiah(t.total)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.customer_name || t.customer_phone || 'Pelanggan Umum'}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{new Date(t.created_at).toLocaleDateString('id-ID')}</p>
                          <p>{new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-xs px-2 py-0.5 bg-secondary rounded-full capitalize">
                          {t.payment_method}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(t)}
                            className="h-8 px-2"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Detail
                          </Button>
                          {t.customer_phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendWhatsApp(t)}
                              disabled={sendingWhatsApp === t.id}
                              className="h-8 px-2 text-green-500 hover:text-green-600"
                            >
                              {sendingWhatsApp === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MessageCircle className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <Receipt data={convertToReceiptData(selectedTransaction)} />
              {selectedTransaction.customer_phone && (
                <Button
                  onClick={() => handleResendWhatsApp(selectedTransaction)}
                  disabled={sendingWhatsApp === selectedTransaction.id}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {sendingWhatsApp === selectedTransaction.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  Kirim Ulang via WhatsApp
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
