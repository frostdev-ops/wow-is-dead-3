import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLoginMutation } from '../hooks/queries';
import './LoginPage.css';

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
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>WOWID3</h1>
          <p>Modpack Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {loginMutation.isError && (
            <div className="alert alert-error">
              {loginMutation.error?.message || 'Login failed'}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Admin Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="form-input"
              disabled={loginMutation.isPending}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending || !password}
            className="btn-login"
          >
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p>Secure admin access to manage modpack releases</p>
        </div>
      </div>
    </div>
  );
}
