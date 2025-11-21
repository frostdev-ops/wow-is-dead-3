import { FC } from 'react';
import { UserMenu } from '../UserMenu';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SecureAvatar } from '../SecureAvatar';

export interface AuthenticationCardProps {
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: {
    username: string;
    uuid: string;
    skin_url?: string;
    session_id: string;
  };
  minecraftInstalled: boolean;
}

export const AuthenticationCard: FC<AuthenticationCardProps> = ({
  isAuthenticated,
  isLoading,
  user,
  minecraftInstalled,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-black bg-opacity-20 rounded-lg flex justify-center border border-slate-600 border-opacity-30">
        <LoadingSpinner size="md" message="Authenticating with Microsoft..." />
      </div>
    );
  }

  // Authenticated state
  if (isAuthenticated && user) {
    return (
      <div
        className="flex items-center justify-between px-5 py-6 pt-5 mt-4 border border-christmas-gold border-opacity-30 rounded-lg"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(77, 130, 110, 0.65) 0%, rgba(0, 0, 0, 0.5) 50%, rgba(70, 130, 180, 0.65) 100%)',
        }}
      >
        <div className="flex items-center space-x-4">
          <SecureAvatar
            username={user.username}
            className="w-14 h-14 shadow-lg rounded"
            alt={user.username}
          />
          <div>
            <p className="text-white font-bold text-lg">{user.username}</p>
            <p className="text-sm text-christmas-gold">Authenticated</p>
          </div>
        </div>
        <UserMenu user={user} />
      </div>
    );
  }

  // Login required state (only shown when Minecraft is installed but not authenticated)
  if (minecraftInstalled) {
    return (
      <div
        className="p-4 rounded-lg text-center border border-opacity-50"
        style={{
          backgroundColor: 'rgba(8, 91, 46, 0.8)',
          borderColor: '#cdf1e1ff',
        }}
      >
        <p
          className="font-semibold mb-1"
          style={{
            color: '#c6ebdaff',
            fontFamily: "'Trebuchet MS', sans-serif",
            fontWeight: 'bold',
          }}
        >
          Login Required
        </p>
        <p
          className="text-sm"
          style={{
            color: '#c6ebdaff',
            fontFamily: "'Trebuchet MS', sans-serif",
            fontWeight: 'bold',
          }}
        >
          Click "Login" to authenticate with your Microsoft account
        </p>
      </div>
    );
  }

  // No authentication UI needed when Minecraft is not installed
  return null;
};
