import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Trash2, Shield, ShoppingCart, Loader2, Link, Save, MapPin, Phone, Building2, CreditCard, Upload, Image, Printer, Bluetooth, Unlink, Percent } from 'lucide-react';
import { isBluetoothSupported, PRINTER_SERVICE_UUIDS, PRINTER_CHARACTERISTIC_UUIDS } from '@/utils/escpos';

type AppRole = 'admin' | 'cashier';

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole | null;
  created_at: string;
  printerName?: string | null;
  printerDeviceId?: string | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoadingRole } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('cashier');
  const [isCreating, setIsCreating] = useState(false);

  // Public invoice URL setting
  const [publicInvoiceUrl, setPublicInvoiceUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  // Store info settings
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [isSavingStoreInfo, setIsSavingStoreInfo] = useState(false);

  // Bank transfer settings
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // QRIS image
  const [qrisImageUrl, setQrisImageUrl] = useState('');
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  // Bulk price percentage setting
  const [bulkPricePercentage, setBulkPricePercentage] = useState('98');
  const [isSavingBulkPrice, setIsSavingBulkPrice] = useState(false);

  // Printer config state
  const [connectingPrinterForUser, setConnectingPrinterForUser] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoadingRole && !isAdmin) {
      toast.error('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.');
      navigate('/');
    }
  }, [isAdmin, isLoadingRole, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAllSettings();
    }
  }, [isAdmin]);

  const fetchAllSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');
      
      if (error) throw error;
      
      const settings = data?.reduce((acc, item) => {
        acc[item.key] = item.value || '';
        return acc;
      }, {} as Record<string, string>) || {};

      setPublicInvoiceUrl(settings['public_invoice_base_url'] || '');
      setStoreAddress(settings['store_address'] || '');
      setStorePhone(settings['store_phone'] || '');
      setBankName(settings['bank_name'] || '');
      setBankAccountNumber(settings['bank_account_number'] || '');
      setBankAccountHolder(settings['bank_account_holder'] || '');
      setQrisImageUrl(settings['qris_image_url'] || '');
      setBulkPricePercentage(settings['bulk_price_percentage'] || '98');
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const updateSetting = async (key: string, value: string | null) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    
    if (error) throw error;
  };

  const handleSavePublicUrl = async () => {
    setIsSavingUrl(true);
    try {
      const normalizedUrl = publicInvoiceUrl.trim().replace(/\/$/, '');
      await updateSetting('public_invoice_base_url', normalizedUrl || null);
      setPublicInvoiceUrl(normalizedUrl);
      toast.success('URL struk publik berhasil disimpan');
    } catch (error) {
      console.error('Error saving public URL:', error);
      toast.error('Gagal menyimpan URL');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleSaveStoreInfo = async () => {
    setIsSavingStoreInfo(true);
    try {
      await Promise.all([
        updateSetting('store_address', storeAddress.trim() || null),
        updateSetting('store_phone', storePhone.trim() || null),
      ]);
      toast.success('Informasi toko berhasil disimpan');
    } catch (error) {
      console.error('Error saving store info:', error);
      toast.error('Gagal menyimpan informasi toko');
    } finally {
      setIsSavingStoreInfo(false);
    }
  };

  const handleSaveBankInfo = async () => {
    setIsSavingBank(true);
    try {
      await Promise.all([
        updateSetting('bank_name', bankName.trim() || null),
        updateSetting('bank_account_number', bankAccountNumber.trim() || null),
        updateSetting('bank_account_holder', bankAccountHolder.trim() || null),
      ]);
      toast.success('Informasi bank berhasil disimpan');
    } catch (error) {
      console.error('Error saving bank info:', error);
      toast.error('Gagal menyimpan informasi bank');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleSaveBulkPricePercentage = async () => {
    const percentage = parseInt(bulkPricePercentage, 10);
    if (isNaN(percentage) || percentage < 1 || percentage > 100) {
      toast.error('Persentase harus antara 1-100');
      return;
    }

    setIsSavingBulkPrice(true);
    try {
      await updateSetting('bulk_price_percentage', String(percentage));
      toast.success(`Formula harga grosir berhasil disimpan (${percentage}% dari harga eceran)`);
    } catch (error) {
      console.error('Error saving bulk price percentage:', error);
      toast.error('Gagal menyimpan formula harga grosir');
    } finally {
      setIsSavingBulkPrice(false);
    }
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    setIsUploadingQris(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qris.${fileExt}`;

      // Delete existing QRIS image if exists
      await supabase.storage.from('qris').remove([fileName]);

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('qris')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('qris')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl + '?t=' + Date.now(); // Cache bust

      // Save URL to settings
      await updateSetting('qris_image_url', imageUrl);
      setQrisImageUrl(imageUrl);
      toast.success('Gambar QRIS berhasil diupload');
    } catch (error) {
      console.error('Error uploading QRIS:', error);
      toast.error('Gagal mengupload gambar QRIS');
    } finally {
      setIsUploadingQris(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');
      
      if (rolesError) throw rolesError;

      // Fetch printer configs
      const { data: printerConfigs, error: printerError } = await supabase
        .from('printer_configs')
        .select('user_id, printer_name, printer_device_id');
      
      if (printerError) console.error('Error fetching printer configs:', printerError);

      // Map printer configs by user_id
      const printerMap = new Map(
        (printerConfigs || []).map(p => [p.user_id, { name: p.printer_name, deviceId: p.printer_device_id }])
      );

      const usersWithRoles: UserWithRole[] = rolesData.map(r => ({
        id: r.user_id,
        email: '',
        role: r.role as AppRole,
        created_at: r.created_at,
        printerName: printerMap.get(r.user_id)?.name || null,
        printerDeviceId: printerMap.get(r.user_id)?.deviceId || null,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Gagal memuat daftar pengguna');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newPassword) {
      toast.error('Email dan password harus diisi');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setIsCreating(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (!authData.user) {
        toast.error('Gagal membuat pengguna');
        return;
      }

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: newRole
        });

      if (roleError) {
        toast.error('Pengguna dibuat tapi gagal menetapkan role');
        return;
      }

      toast.success(`Pengguna ${newEmail} berhasil dibuat sebagai ${newRole}`);
      setNewEmail('');
      setNewPassword('');
      setNewRole('cashier');
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Gagal membuat pengguna');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRole = async (userId: string) => {
    if (!confirm('Yakin ingin menghapus role pengguna ini? Pengguna tidak akan bisa mengakses sistem.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Role pengguna berhasil dihapus');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Gagal menghapus role');
    }
  };

  const handleChangeRole = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Role berhasil diubah');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Gagal mengubah role');
    }
  };

  const handleConnectPrinterForUser = async (userId: string) => {
    if (!isBluetoothSupported()) {
      toast.error('Browser tidak mendukung Bluetooth. Gunakan Chrome di Android.');
      return;
    }

    setConnectingPrinterForUser(userId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      const bluetoothDevice = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
      });

      if (!bluetoothDevice.gatt) {
        throw new Error('GATT tidak tersedia');
      }

      // Connect to verify it works
      const server = await bluetoothDevice.gatt.connect();

      // Find writable characteristic to verify printer
      let writeCharacteristic = null;

      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          
          for (const charUuid of PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              const char = await service.getCharacteristic(charUuid);
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeCharacteristic = char;
                break;
              }
            } catch {
              // Try next characteristic
            }
          }
          
          if (writeCharacteristic) break;

          // Try to get all characteristics
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeCharacteristic = char;
              break;
            }
          }
          
          if (writeCharacteristic) break;
        } catch {
          // Service not found, try next
        }
      }

      if (!writeCharacteristic) {
        throw new Error('Tidak dapat menemukan karakteristik tulis pada printer');
      }

      // Disconnect after verification
      bluetoothDevice.gatt.disconnect();

      const printerName = bluetoothDevice.name || 'Unknown Printer';
      const printerDeviceId = bluetoothDevice.id;

      // Save to database - upsert
      const { error } = await supabase
        .from('printer_configs')
        .upsert({
          user_id: userId,
          printer_name: printerName,
          printer_device_id: printerDeviceId,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success(`Printer "${printerName}" berhasil dikonfigurasi`);
      fetchUsers();
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Gagal menghubungkan printer';
      
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('canceled')) {
        toast.error(errorMessage);
      }
    } finally {
      setConnectingPrinterForUser(null);
    }
  };

  const handleRemovePrinterConfig = async (userId: string) => {
    if (!confirm('Yakin ingin menghapus konfigurasi printer untuk pengguna ini?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('printer_configs')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Konfigurasi printer berhasil dihapus');
      fetchUsers();
    } catch (error) {
      console.error('Error removing printer config:', error);
      toast.error('Gagal menghapus konfigurasi printer');
    }
  };

  if (isLoadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-xl">Pengaturan Admin</h1>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Store Info Settings */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Informasi Toko
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Alamat dan nomor telepon yang akan tampil di struk
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Alamat Toko</label>
              <Input
                type="text"
                placeholder="Jl. Raya No. 88, Jakarta"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nomor Telepon</label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="(021) 1234-5678"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveStoreInfo} disabled={isSavingStoreInfo}>
                  {isSavingStoreInfo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Bulk Price Formula Setting */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Formula Harga Grosir
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Persentase dari harga eceran untuk menghitung harga grosir default. 
            Contoh: 98% berarti harga grosir = harga eceran × 0.98
          </p>
          
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="1"
              max="100"
              placeholder="98"
              value={bulkPricePercentage}
              onChange={(e) => setBulkPricePercentage(e.target.value)}
              className="w-24"
            />
            <span className="text-muted-foreground">%</span>
            <Button onClick={handleSaveBulkPricePercentage} disabled={isSavingBulkPrice} className="ml-auto">
              {isSavingBulkPrice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Simpan
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Formula ini digunakan saat produk tidak memiliki harga grosir yang ditetapkan secara manual.
          </p>
        </section>

        {/* QRIS Image Upload */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Image className="w-5 h-5" />
            Gambar QRIS
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload gambar QRIS untuk ditampilkan saat pelanggan memilih pembayaran QRIS
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {qrisImageUrl && (
              <div className="w-40 h-40 border border-border rounded-lg overflow-hidden bg-white flex items-center justify-center">
                <img 
                  src={qrisImageUrl} 
                  alt="QRIS" 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleQrisUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploadingQris}
                variant="outline"
              >
                {isUploadingQris ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {qrisImageUrl ? 'Ganti Gambar' : 'Upload Gambar'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Format: JPG, PNG. Maksimal 2MB
              </p>
            </div>
          </div>
        </section>

        {/* Bank Transfer Settings */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informasi Transfer Bank
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Informasi rekening untuk pembayaran transfer
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nama Bank</label>
              <Input
                type="text"
                placeholder="BCA, Mandiri, BRI, dll"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nomor Rekening</label>
              <Input
                type="text"
                placeholder="1234567890"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Atas Nama</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Nama pemilik rekening"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveBankInfo} disabled={isSavingBank}>
                  {isSavingBank ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Public Invoice URL Setting */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Link className="w-5 h-5" />
            URL Struk Publik
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Masukkan URL domain publik agar QR code struk bisa diakses pelanggan tanpa login. 
            Contoh: https://toko88.lovable.app
          </p>
          
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://your-domain.com"
              value={publicInvoiceUrl}
              onChange={(e) => setPublicInvoiceUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSavePublicUrl} disabled={isSavingUrl}>
              {isSavingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Create New User */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Tambah Pengguna Baru
          </h2>
          
          <form onSubmit={handleCreateUser} className="grid sm:grid-cols-4 gap-4">
            <Input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="sm:col-span-1"
            />
            <Input
              type="password"
              placeholder="Password (min 6 karakter)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="sm:col-span-1"
            />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Kasir
                  </span>
                </SelectItem>
                <SelectItem value="admin">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Admin
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Tambah'
              )}
            </Button>
          </form>
        </section>

        {/* User List */}
        <section className="pos-card p-6">
          <h2 className="text-lg font-semibold mb-4">Daftar Pengguna</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada pengguna terdaftar
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Printer</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">
                      {user.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role || 'cashier'}
                        onValueChange={(v) => handleChangeRole(user.id, v as AppRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">Kasir</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.printerName ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                            <Bluetooth className="w-3 h-3" />
                            {user.printerName}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemovePrinterConfig(user.id)}
                            title="Hapus printer"
                          >
                            <Unlink className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleConnectPrinterForUser(user.id)}
                          disabled={connectingPrinterForUser === user.id || !isBluetoothSupported()}
                        >
                          {connectingPrinterForUser === user.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Printer className="w-3 h-3 mr-1" />
                          )}
                          Set Printer
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRole(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </div>
  );
}
