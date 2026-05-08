const websocketService = require('../services/websocketService');

// Middleware to broadcast real-time updates after successful operations
const broadcastUpdate = (eventType, dataExtractor) => {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to intercept response
    res.json = function(data) {
      // Call original json method first
      originalJson.call(this, data);
      
      // Only broadcast on successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const extractedData = dataExtractor ? dataExtractor(data, req) : data;
          
          switch (eventType) {
            case 'loan_update':
              websocketService.broadcastLoanUpdate(extractedData, 'loan_update');
              break;
            case 'loan_created':
              websocketService.broadcastLoanUpdate(extractedData, 'loan_created');
              break;
            case 'loan_status_changed':
              websocketService.broadcastLoanUpdate(extractedData, 'loan_status_changed');
              break;
            case 'user_update':
              websocketService.broadcastUserUpdate(extractedData, 'user_update');
              break;
            case 'user_created':
              websocketService.broadcastUserUpdate(extractedData, 'user_created');
              break;
            case 'user_status_changed':
              websocketService.broadcastUserUpdate(extractedData, 'user_status_changed');
              break;
            case 'payment_update':
              websocketService.broadcastPaymentUpdate(extractedData, 'payment_update');
              break;
            case 'payment_created':
              websocketService.broadcastPaymentUpdate(extractedData, 'payment_created');
              break;
            case 'admin_update':
              websocketService.broadcastNotification({
                type: 'admin_update',
                message: 'Admin data has been updated',
                data: extractedData
              });
              break;
            case 'system_config_update':
              websocketService.broadcastConfigUpdate(extractedData, 'system_config_update');
              websocketService.broadcastNotification({
                type: 'system_config_update',
                message: 'System configuration has been updated',
                data: extractedData
              });
              break;
            default:
              console.log(`Unknown event type: ${eventType}`);
          }
        } catch (error) {
          console.error('Error broadcasting real-time update:', error);
        }
      }
    };
    
    next();
  };
};

// Specific middleware for different types of updates
const broadcastLoanUpdate = broadcastUpdate('loan_update', (data) => data.loan || data);
const broadcastLoanCreated = broadcastUpdate('loan_created', (data) => data.loan || data);
const broadcastLoanStatusChanged = broadcastUpdate('loan_status_changed', (data) => data.loan || data);

const broadcastUserUpdate = broadcastUpdate('user_update', (data) => data.user || data);
const broadcastUserCreated = broadcastUpdate('user_created', (data) => data.user || data);
const broadcastUserStatusChanged = broadcastUpdate('user_status_changed', (data) => data.user || data);

const broadcastPaymentUpdate = broadcastUpdate('payment_update', (data) => data.payment || data);
const broadcastPaymentCreated = broadcastUpdate('payment_created', (data) => data.payment || data);

const broadcastAdminUpdate = broadcastUpdate('admin_update', (data) => data.admin || data);
const broadcastSystemConfigUpdate = broadcastUpdate('system_config_update', (data) => data.config || data);

// Notification middleware for specific events
const sendNotification = (notificationType, messageGenerator, targetRoleOrAdmin = null) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      originalJson.call(this, data);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const message = typeof messageGenerator === 'function' 
            ? messageGenerator(data, req) 
            : messageGenerator;
          
          const notification = {
            type: notificationType,
            message: message,
            data: data,
            adminId: req.admin?.id,
            adminEmail: req.admin?.email
          };
          
          if (typeof targetRoleOrAdmin === 'function') {
            const target = targetRoleOrAdmin(data, req);
            if (target.type === 'role') {
              websocketService.broadcastNotification(notification, target.value);
            } else if (target.type === 'admin') {
              websocketService.broadcastNotification(notification, null, target.value);
            }
          } else if (targetRoleOrAdmin) {
            websocketService.broadcastNotification(notification, targetRoleOrAdmin);
          } else {
            websocketService.broadcastNotification(notification);
          }
        } catch (error) {
          console.error('Error sending notification:', error);
        }
      }
    };
    
    next();
  };
};

// Dashboard update trigger
const triggerDashboardUpdate = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    originalJson.call(this, data);
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Trigger dashboard update after successful operations
      setTimeout(() => {
        websocketService.sendDashboardData();
      }, 100); // Small delay to ensure database is updated
    }
  };
  
  next();
};

module.exports = {
  broadcastUpdate,
  broadcastLoanUpdate,
  broadcastLoanCreated,
  broadcastLoanStatusChanged,
  broadcastUserUpdate,
  broadcastUserCreated,
  broadcastUserStatusChanged,
  broadcastPaymentUpdate,
  broadcastPaymentCreated,
  broadcastAdminUpdate,
  broadcastSystemConfigUpdate,
  sendNotification,
  triggerDashboardUpdate
};