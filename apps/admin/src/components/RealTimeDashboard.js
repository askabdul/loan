import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp,
  TrendingDown,
  People,
  AccountBalance,
  Payment,
  Notifications,
  WifiOff,
  Wifi
} from '@mui/icons-material';
import { useRealtime } from '../hooks/useRealtime';

const StatCard = ({ title, value, change, icon: Icon, color = 'primary', loading = false }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {loading ? <CircularProgress size={24} /> : value}
            </Typography>
            {change && (
              <Box display="flex" alignItems="center" mt={1}>
                {change > 0 ? (
                  <TrendingUp color="success" fontSize="small" />
                ) : (
                  <TrendingDown color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={change > 0 ? 'success.main' : 'error.main'}
                  sx={{ ml: 0.5 }}
                >
                  {Math.abs(change)}%
                </Typography>
              </Box>
            )}
          </Box>
          <Icon color={color} sx={{ fontSize: 40, opacity: 0.7 }} />
        </Box>
      </CardContent>
    </Card>
  );
};

const RealTimeDashboard = () => {
  const {
    connected,
    dashboardData,
    notifications,
    requestDashboardData
  } = useRealtime();
  
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (connected) {
      requestDashboardData();
    }
  }, [connected, requestDashboardData]);

  useEffect(() => {
    if (dashboardData) {
      setLastUpdate(new Date());
      setLoading(false);
    }
  }, [dashboardData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!connected) return;
    
    const interval = setInterval(() => {
      requestDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [connected, requestDashboardData]);

  const handleRefresh = () => {
    setLoading(true);
    requestDashboardData();
  };

  const getStats = () => {
    if (!dashboardData) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalLoans: 0,
        activeLoans: 0,
        totalDisbursed: 0,
        successfulPayments: 0
      };
    }

    const { loanStats, userStats, paymentStats } = dashboardData;
    
    const totalLoans = loanStats?.reduce((sum, stat) => sum + stat.count, 0) || 0;
    const activeLoans = loanStats?.filter(stat => 
      ['approved', 'disbursed', 'active'].includes(stat._id)
    ).reduce((sum, stat) => sum + stat.count, 0) || 0;
    
    const totalDisbursed = loanStats?.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0) || 0;
    
    const successfulPayments = paymentStats?.find(stat => stat._id === 'completed')?.count || 0;

    return {
      totalUsers: userStats?.totalUsers || 0,
      activeUsers: userStats?.activeUsers || 0,
      totalLoans,
      activeLoans,
      totalDisbursed,
      successfulPayments
    };
  };

  const stats = getStats();

  return (
    <Box>
      {/* Connection Status */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" component="h1">
          Real-Time Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={connected ? <Wifi /> : <WifiOff />}
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} disabled={!connected}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Connection Alert */}
      {!connected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Real-time connection lost. Data may not be up to date. Attempting to reconnect...
        </Alert>
      )}

      {/* Last Update Info */}
      {lastUpdate && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Typography>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={People}
            color="primary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Users"
            value={stats.activeUsers.toLocaleString()}
            icon={People}
            color="success"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Loans"
            value={stats.totalLoans.toLocaleString()}
            icon={AccountBalance}
            color="info"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Loans"
            value={stats.activeLoans.toLocaleString()}
            icon={AccountBalance}
            color="warning"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Disbursed"
            value={`₵${stats.totalDisbursed.toLocaleString()}`}
            icon={Payment}
            color="success"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Successful Payments"
            value={stats.successfulPayments.toLocaleString()}
            icon={Payment}
            color="primary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Notifications"
            value={notifications.length.toLocaleString()}
            icon={Notifications}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Connection Status"
            value={connected ? 'Online' : 'Offline'}
            icon={connected ? Wifi : WifiOff}
            color={connected ? 'success' : 'error'}
          />
        </Grid>
      </Grid>

      {/* Recent Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Notifications
            </Typography>
            <Box>
              {notifications.slice(0, 5).map((notification, index) => (
                <Box
                  key={notification._id || index}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  py={1}
                  borderBottom={index < 4 ? 1 : 0}
                  borderColor="divider"
                >
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {notification.title || notification.type}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {notification.message}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(notification.createdAt).toLocaleTimeString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RealTimeDashboard;