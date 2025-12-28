import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Store } from 'lucide-react';
import { toast } from 'sonner';

const CREDENTIALS = {
  username: 'toko88',
  password: 'toko8888',
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
        sessionStorage.setItem('pos_authenticated', 'true');
        toast.success('Login berhasil!');
        navigate('/');
      } else {
        toast.error('Username atau password salah');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="pos-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Store className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Toko 88</h1>
            <p className="text-muted-foreground text-sm">Point of Sale System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="h-11"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="h-11"
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 mt-2"
              disabled={isLoading || !username || !password}
            >
              <Lock className="w-4 h-4 mr-2" />
              {isLoading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
