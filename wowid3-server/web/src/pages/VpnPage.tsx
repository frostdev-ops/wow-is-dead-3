import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageTransition, containerVariants, statsCardVariants, itemVariants } from '@/components/PageTransition';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/useToast';
import api from '@/api/client';
import {
  Network,
  Users,
  Activity,
  HardDrive,
  Trash2,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface PeerInfo {
  uuid: string;
  username: string;
  ip_address: string;
  online: boolean;
  last_handshake: number | null;
  bytes_sent: number;
  bytes_received: number;
  registered_at: number;
}

interface VpnStats {
  total_peers: number;
  active_connections: number;
  total_bandwidth_sent: number;
  total_bandwidth_received: number;
  peers: PeerInfo[];
}

export default function VpnPage() {
  const [stats, setStats] = useState<VpnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchVpnStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get<VpnStats>('/admin/vpn/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch VPN stats:', error);
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to fetch VPN statistics',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRevokePeer = async (uuid: string, username: string) => {
    if (!confirm(`Revoke VPN access for ${username}?`)) return;

    try {
      await api.delete(`/admin/vpn/peers/${uuid}`);
      toast({
        title: 'Success',
        description: `VPN access revoked for ${username}`,
      });
      fetchVpnStats(true);
    } catch (error) {
      console.error('Failed to revoke peer:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke VPN access',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVpnStats(true);
  };

  useEffect(() => {
    fetchVpnStats();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchVpnStats(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading VPN statistics..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <PageTransition>
        <div className="p-6">
          <Card className="p-6">
            <p className="text-muted-foreground">Failed to load VPN statistics</p>
          </Card>
        </div>
      </PageTransition>
    );
  }

  const statCards = [
    {
      label: 'Total Peers',
      value: stats.total_peers,
      icon: <Users className="w-6 h-6 text-blue-500" />,
      color: 'from-blue-500/20 to-blue-600/5',
      border: 'border-blue-500/20',
    },
    {
      label: 'Active Connections',
      value: stats.active_connections,
      icon: <Activity className="w-6 h-6 text-green-500" />,
      color: 'from-green-500/20 to-green-600/5',
      border: 'border-green-500/20',
    },
    {
      label: 'Total Sent',
      value: formatBytes(stats.total_bandwidth_sent),
      icon: <Network className="w-6 h-6 text-purple-500" />,
      color: 'from-purple-500/20 to-purple-600/5',
      border: 'border-purple-500/20',
    },
    {
      label: 'Total Received',
      value: formatBytes(stats.total_bandwidth_received),
      icon: <HardDrive className="w-6 h-6 text-orange-500" />,
      color: 'from-orange-500/20 to-orange-600/5',
      border: 'border-orange-500/20',
    },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">VPN Monitoring</h1>
            <p className="text-muted-foreground">Monitor WireGuard VPN connections and bandwidth</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {statCards.map((stat, i) => (
            <motion.div key={i} variants={statsCardVariants}>
              <Card className={`p-6 bg-gradient-to-br ${stat.color} ${stat.border} backdrop-blur-xl`}>
                <motion.div
                  className="flex items-start justify-between"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md shadow-inner">
                    {stat.icon}
                  </div>
                </motion.div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Peer List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Connected Peers</h2>
            <Badge variant="outline" className="text-sm">
              {stats.active_connections} / {stats.total_peers} online
            </Badge>
          </div>

          {stats.peers.length === 0 ? (
            <div className="text-center py-12">
              <Network className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No VPN peers registered yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left pb-4 pl-4">Status</th>
                    <th className="text-left pb-4">Username</th>
                    <th className="text-left pb-4">IP Address</th>
                    <th className="text-left pb-4">Last Seen</th>
                    <th className="text-left pb-4">Bandwidth</th>
                    <th className="text-right pb-4 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.peers.map((peer) => (
                    <motion.tr
                      key={peer.uuid}
                      variants={itemVariants}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 pl-4">
                        <div className="flex items-center gap-2">
                          {peer.online ? (
                            <>
                              <Wifi className="w-4 h-4 text-green-500" />
                              <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
                                Online
                              </Badge>
                            </>
                          ) : (
                            <>
                              <WifiOff className="w-4 h-4 text-gray-500" />
                              <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                                Offline
                              </Badge>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div>
                          <p className="font-medium">{peer.username}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {peer.uuid.substring(0, 8)}...
                          </p>
                        </div>
                      </td>
                      <td className="py-4">
                        <code className="text-sm bg-white/5 px-2 py-1 rounded">
                          {peer.ip_address}
                        </code>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(peer.last_handshake)}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm">
                          <div className="text-muted-foreground">
                            ↑ {formatBytes(peer.bytes_sent)}
                          </div>
                          <div className="text-muted-foreground">
                            ↓ {formatBytes(peer.bytes_received)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <Button
                          onClick={() => handleRevokePeer(peer.uuid, peer.username)}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Info Banner */}
        <Card className="p-4 bg-blue-500/10 border-blue-500/20">
          <div className="flex items-start gap-3">
            <Network className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500">VPN Monitoring Active</p>
              <p className="text-muted-foreground mt-1">
                Statistics refresh automatically every 10 seconds. Peers are considered online if their last handshake
                was within the last 3 minutes.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
