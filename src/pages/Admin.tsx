import { useState, useEffect } from 'react';
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
import { ArrowLeft, UserPlus, Trash2, Shield, ShoppingCart, Loader2, Link, Save } from 'lucide-react';

type AppRole = 'admin' | 'cashier';

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole | null;
  created_at: string;
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

  useEffect(() => {
    if (!isLoadingRole && !isAdmin) {
      toast.error('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.');
      navigate('/');
    }
  }, [isAdmin, isLoadingRole, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPublicInvoiceUrl();
    }
  }, [isAdmin]);

  const fetchPublicInvoiceUrl = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'public_invoice_base_url')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      setPublicInvoiceUrl(data?.value || '');
    } catch (error) {
      console.error('Error fetching public invoice URL:', error);
    }
  };

  const handleSavePublicUrl = async () => {
    setIsSavingUrl(true);
    try {
      // Normalize URL: remove trailing slash
      const normalizedUrl = publicInvoiceUrl.trim().replace(/\/$/, '');
      
      const { error } = await supabase
        .from('app_settings')
        .update({ value: normalizedUrl || null, updated_at: new Date().toISOString() })
        .eq('key', 'public_invoice_base_url');
      
      if (error) throw error;
      
      setPublicInvoiceUrl(normalizedUrl);
      toast.success('URL struk publik berhasil disimpan');
    } catch (error) {
      console.error('Error saving public URL:', error);
      toast.error('Gagal menyimpan URL');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: rolesData, error } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');
      
      if (error) throw error;

      // Get user emails from auth (we can only see users with roles)
      const usersWithRoles: UserWithRole[] = rolesData.map(r => ({
        id: r.user_id,
        email: '', // We'll need to store this separately or use a profiles table
        role: r.role as AppRole,
        created_at: r.created_at
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
      // Create user via Supabase Auth
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

      // Assign role to the new user
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
                <h1 className="font-bold text-xl">Kelola Pengguna</h1>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-8">
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