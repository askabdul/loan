import React, { useEffect, useState } from 'react';
import {
  Box,
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Button,
  Divider,
  Chip,
  Alert
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  AccountBalance,
  Payment,
  Info,
  Warning,
  CheckCircle,
  WifiOff,
  Wifi
} from '@mui/icons-material';
import { useRealtime } from '../hooks/useRealtime';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'loan_status':
      return <AccountBalance color="primary" />;
    case 'payment':
      return <Payment color="success" />;
    case 'announcement':
      return <Info color="info" />;
    case 'warning':
      return <Warning color="warning" />;
    case 'success':
      return <CheckCircle color="success" />;
    default:
      return <Info color="primary" />;
  }
};

const getNotificationColor = (type, priority) => {
  if (priority === 'high') return 'error';
  switch (type) {
    case 'loan_status':
      return 'primary';
    case 'payment':
      return 'success';
    case 'warning':
      return 'warning';
    default:
      return 'default';
  }
};

const RealTimeNotifications = () => {
  const {
    connected,
    notifications,
    unreadCount,
    requestNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useRealtime();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [showConnectionAlert, setShowConnectionAlert] = useState(false);

  useEffect(() => {
    if (connected) {
      requestNotifications();
      setShowConnectionAlert(false);
    } else {
      setShowConnectionAlert(true);
    }
  }, [connected, requestNotifications]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markNotificationAsRead(notification._id);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead();
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notifications-popover' : undefined;

  return (
    <Box>
      {/* Connection Alert */}
      {showConnectionAlert && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          onClose={() => setShowConnectionAlert(false)}
        >
          Real-time notifications are currently unavailable. Please check your connection.
        </Alert>
      )}

      {/* Notification Bell */}
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-describedby={id}
      >
        <Badge badgeContent={unreadCount} color="error">
          {connected ? <NotificationsIcon /> : <WifiOff />}
        </Badge>
      </IconButton>

      {/* Notifications Popover */}
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 400, maxHeight: 500 }
        }}
      >
        <Box p={2}>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">
              Notifications
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                icon={connected ? <Wifi /> : <WifiOff />}
                label={connected ? 'Live' : 'Offline'}
                size="small"
                color={connected ? 'success' : 'error'}
                variant="outlined"
              />
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={handleMarkAllAsRead}
                  disabled={!connected}
                >
                  Mark All Read
                </Button>
              )}
            </Box>
          </Box>

          <Divider />

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <Box textAlign="center" py={4}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="textSecondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification._id || index}>
                  <ListItem
                    button
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography
                            variant="subtitle2"
                            fontWeight={notification.isRead ? 'normal' : 'bold'}
                          >
                            {notification.title}
                          </Typography>
                          {notification.priority === 'high' && (
                            <Chip
                              label="High"
                              size="small"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{ mb: 0.5 }}
                          >
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {new Date(notification.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <Box>
              <Divider sx={{ my: 2 }} />
              <Box textAlign="center">
                <Button
                  variant="text"
                  size="small"
                  onClick={handleClose}
                >
                  View All Notifications
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Popover>
    </Box>
  );
};

export default RealTimeNotifications;