import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useRealtime = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loanData, setLoanData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, token } = useAuth();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Initialize socket connection
  useEffect(() => {
    if (!token || !user) return;

    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token,
        userId: user._id,
        role: 'user'
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ Connected to real-time server');
      setConnected(true);
      reconnectAttempts.current = 0;
      
      // Join user-specific room
      newSocket.emit('join-user-room', {
        userId: user._id
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from real-time server:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔥 Connection error:', error);
      setConnected(false);
      
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(() => {
          console.log(`🔄 Reconnection attempt ${reconnectAttempts.current}`);
          newSocket.connect();
        }, 2000 * reconnectAttempts.current);
      }
    });

    // Real-time data events
    newSocket.on('loan-update', (data) => {
      console.log('💰 Loan update received:', data);
      if (data.userId === user._id) {
        setLoanData(data);
      }
    });

    newSocket.on('loan-status-changed', (data) => {
      console.log('🔄 Loan status changed:', data);
      setLoanData(prevData => {
        if (!prevData) return null;
        
        // Update specific loan in the user's list
        const updatedLoans = prevData.loans?.map(loan => 
          loan._id === data.loanId ? { ...loan, status: data.status } : loan
        );
        
        return {
          ...prevData,
          loans: updatedLoans || prevData.loans
        };
      });
      
      // Show notification for loan status change
      if (data.message) {
        setNotifications(prev => [{
          _id: Date.now().toString(),
          type: 'loan_status',
          title: 'Loan Status Update',
          message: data.message,
          createdAt: new Date(),
          isRead: false
        }, ...prev.slice(0, 9)]);
        setUnreadCount(prev => prev + 1);
      }
    });

    newSocket.on('payment-update', (data) => {
      console.log('💳 Payment update received:', data);
      if (data.userId === user._id) {
        setPaymentData(data);
      }
    });

    newSocket.on('payment-notification', (data) => {
      console.log('💳 Payment notification received:', data);
      setNotifications(prev => [{
        _id: Date.now().toString(),
        type: 'payment',
        title: 'Payment Update',
        message: data.message,
        createdAt: new Date(),
        isRead: false
      }, ...prev.slice(0, 9)]);
      setUnreadCount(prev => prev + 1);
    });

    newSocket.on('notification', (data) => {
      console.log('🔔 Notification received:', data);
      setNotifications(prev => [data, ...prev.slice(0, 9)]); // Keep last 10 notifications
      if (!data.isRead) {
        setUnreadCount(prev => prev + 1);
      }
    });

    newSocket.on('system-announcement', (data) => {
      console.log('📢 System announcement received:', data);
      setNotifications(prev => [{
        _id: Date.now().toString(),
        type: 'announcement',
        title: 'System Announcement',
        message: data.message,
        createdAt: new Date(),
        isRead: false,
        priority: 'high'
      }, ...prev.slice(0, 9)]);
      setUnreadCount(prev => prev + 1);
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Cleaning up socket connection');
      newSocket.disconnect();
    };
  }, [token, user]);

  // Request live loan data
  const requestLoanData = useCallback(() => {
    if (socket && connected) {
      socket.emit('request-user-loans');
    }
  }, [socket, connected]);

  // Request live payment data
  const requestPaymentData = useCallback(() => {
    if (socket && connected) {
      socket.emit('request-user-payments');
    }
  }, [socket, connected]);

  // Request live notifications
  const requestNotifications = useCallback(() => {
    if (socket && connected) {
      socket.emit('request-notifications');
    }
  }, [socket, connected]);

  // Mark notification as read
  const markNotificationAsRead = useCallback((notificationId) => {
    if (socket && connected) {
      socket.emit('mark-notification-read', { notificationId });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [socket, connected]);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(() => {
    if (socket && connected) {
      socket.emit('mark-all-notifications-read');
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    }
  }, [socket, connected]);

  // Send feedback or support message
  const sendFeedback = useCallback((feedback) => {
    if (socket && connected) {
      socket.emit('user-feedback', {
        userId: user._id,
        message: feedback.message,
        type: feedback.type || 'general',
        timestamp: new Date()
      });
    }
  }, [socket, connected, user]);

  return {
    // Connection state
    connected,
    socket,
    
    // Real-time data
    loanData,
    paymentData,
    notifications,
    unreadCount,
    
    // Actions
    requestLoanData,
    requestPaymentData,
    requestNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    sendFeedback
  };
};

export default useRealtime;