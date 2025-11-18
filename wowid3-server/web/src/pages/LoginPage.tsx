import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLoginMutation } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Lock } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const { setToken } = useAuthStore();
  const loginMutation = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(password, {
      onSuccess: (token) => {
        setToken(token);
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center">
                <Lock className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">WOWID3</h1>
            <p className="text-muted-foreground">Modpack Admin Panel</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {loginMutation.isError && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">
                  {loginMutation.error?.message || 'Login failed. Please try again.'}
                </p>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Admin Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-colors disabled:opacity-50"
                disabled={loginMutation.isPending}
                autoFocus
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loginMutation.isPending || !password}
              className="w-full h-10 text-base"
              size="lg"
            >
              {loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Secure admin access to manage modpack releases
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
