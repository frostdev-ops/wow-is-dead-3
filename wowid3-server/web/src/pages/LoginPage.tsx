import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useLoginMutation } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Lock } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

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
    <PageTransition variant="fade">
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Card className="w-full max-w-md shadow-2xl border-white/20 bg-card/60 backdrop-blur-xl">
            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <motion.div
                    className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30"
                    initial={{ rotate: -180, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <Lock className="w-8 h-8 text-white" />
                  </motion.div>
                </div>
                <motion.h1
                  className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-white/70"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  WOWID3
                </motion.h1>
                <motion.p
                  className="text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  Modpack Admin Panel
                </motion.p>
              </div>

              {/* Login Form */}
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              >
                {/* Error Alert */}
                {loginMutation.isError && (
                  <motion.div
                    className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-3 backdrop-blur-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-medium">
                      {loginMutation.error?.message || 'Login failed. Please try again.'}
                    </p>
                  </motion.div>
                )}

                {/* Password Input */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium ml-1">
                    Admin Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all disabled:opacity-50 backdrop-blur-sm hover:bg-black/10 dark:hover:bg-white/10"
                    disabled={loginMutation.isPending}
                    autoFocus
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loginMutation.isPending || !password}
                  className="w-full h-11 text-base rounded-xl"
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
              </motion.form>

              {/* Footer */}
              <motion.div
                className="mt-8 pt-6 border-t border-white/10 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.6 }}
              >
                <p className="text-sm text-muted-foreground">
                  Secure admin access to manage modpack releases
                </p>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}
