import { useState } from 'react';
import { useAuth } from '../hooks';
import { useToast } from './ui/ToastContainer';

interface User {
  username: string;
  uuid: string;
  session_id: string;
}

interface UserMenuProps {
  user: User;
}

export const UserMenu = ({ user }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const { addToast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      addToast('Logged out successfully', 'success');
      setIsOpen(false);
    } catch (error) {
      addToast('Failed to logout', 'error');
    }
  };

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        <span className="text-white font-semibold hidden sm:inline">
          {user.username}
        </span>
        <span className="text-slate-400">▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-slate-700">
            <p className="text-sm text-slate-300">Logged in as</p>
            <p className="text-white font-semibold truncate">{user.username}</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Close on outside click */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
