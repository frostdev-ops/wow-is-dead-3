import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAdmin } from '../hooks/useAdmin';
import './LoginPage.css';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const { setToken } = useAuthStore();
  const { login, loading, error } = useAdmin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await login(password);
      setToken(token);
    } catch {
      // Error is handled in hook
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>WOWID3</h1>
          <p>Modpack Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}

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
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="btn-login"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p>Secure admin access to manage modpack releases</p>
        </div>
      </div>
    </div>
  );
}
