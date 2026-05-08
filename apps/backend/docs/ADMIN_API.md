# CEDI Loan Backend - Admin API Documentation

## Overview

This document provides comprehensive documentation for the CEDI Loan Backend Admin API endpoints. These endpoints are designed for external admin applications to integrate with the loan management system.

## Base URL
```
http://localhost:5000/api/admin
```

## Authentication

All admin endpoints require authentication with admin privileges. Include the JWT token in the Authorization header:

```
Authorization: Bearer <admin_jwt_token>
```

## Response Format

All API responses follow this standard format:

```json
{
  "success": true|false,
  "message": "Response message",
  "data": {
    // Response data
  }
}
```

## Error Handling

Error responses include appropriate HTTP status codes and error messages:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if applicable)
  ]
}
```

## Endpoints

### Dashboard Endpoints

#### GET /dashboard/overview
Get comprehensive dashboard overview with statistics and recent activity.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalLoans": 150,
      "totalUsers": 1200,
      "activeUsers": 980,
      "completedRegistrations": 1100,
      "averageCreditScore": 720,
      "totalDisbursed": 2500000,
      "activeLoans": 45,
      "pendingLoans": 12,
      "completedLoans": 88,
      "rejectedLoans": 5,
      "repaymentRate": 92,
      "totalPayments": 450,
      "successfulPayments": 425,
      "failedPayments": 25
    },
    "recentActivity": {
      "loans": [...],
      "payments": [...],
      "users": [...]
    }
  }
}
```

### User Management Endpoints

#### GET /users
Get all users with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status (active, inactive, completed, incomplete)
- `level` (number): Filter by loan level
- `search` (string): Search by name, email, or phone
- `sortBy` (string): Sort field (default: createdAt)
- `sortOrder` (string): Sort order (asc, desc, default: desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1200,
      "pages": 60
    }
  }
}
```

#### GET /users/:id
Get detailed user information including loan and payment history.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "email": "user@example.com",
      "personalInfo": {...},
      "workInfo": {...},
      "currentLevel": 2,
      "isActive": true,
      "registrationComplete": true
    },
    "loans": [...],
    "payments": [...],
    "summary": {
      "totalLoans": 3,
      "activeLoans": 1,
      "completedLoans": 2,
      "totalBorrowed": 15000,
      "totalRepaid": 12000
    }
  }
}
```

#### PATCH /users/:id/status
Update user status (activate/deactivate).

**Request Body:**
```json
{
  "isActive": true,
  "reason": "Optional reason for status change"
}
```

#### PATCH /users/:id/level
Update user's loan level.

**Request Body:**
```json
{
  "level": 3,
  "reason": "Optional reason for level change"
}
```

### Loan Management Endpoints

#### GET /loans
Get all loans with advanced filtering.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by loan status
- `level` (number): Filter by loan level
- `amountMin` (number): Minimum loan amount
- `amountMax` (number): Maximum loan amount
- `dateFrom` (string): Start date filter (ISO format)
- `dateTo` (string): End date filter (ISO format)
- `search` (string): Search by user details
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Response:**
```json
{
  "success": true,
  "data": {
    "loans": [
      {
        "_id": "loan_id",
        "amount": 5000,
        "status": "active",
        "createdAt": "2024-01-15T10:30:00Z",
        "user": {
          "personalInfo": {
            "firstName": "John",
            "lastName": "Doe"
          },
          "email": "john@example.com",
          "currentLevel": 2
        }
      }
    ],
    "pagination": {...}
  }
}
```

#### GET /loans/:id
Get detailed loan information including payment history.

**Response:**
```json
{
  "success": true,
  "data": {
    "loan": {
      "_id": "loan_id",
      "amount": 5000,
      "status": "active",
      "user": {...},
      "createdAt": "2024-01-15T10:30:00Z",
      "approvedAt": "2024-01-15T11:00:00Z",
      "disbursedAt": "2024-01-15T12:00:00Z"
    },
    "payments": [...]
  }
}
```

#### PATCH /loans/:id/status
Update loan status with admin notes.

**Request Body:**
```json
{
  "status": "approved",
  "rejectionReason": "Optional rejection reason",
  "adminNotes": "Optional admin notes"
}
```

**Valid Status Values:**
- `pending`
- `under-review`
- `approved`
- `rejected`
- `disbursed`
- `active`
- `completed`
- `cancelled`

### System Configuration Endpoints

#### GET /config
Get all system configurations.

**Response:**
```json
{
  "success": true,
  "data": {
    "interestRate": 15,
    "maxLoanAmount": 50000,
    "minLoanAmount": 500,
    "loanTerm": 30,
    "processingFee": 2.5
  }
}
```

#### PUT /config/:key
Update system configuration.

**Request Body:**
```json
{
  "value": 16,
  "description": "Updated interest rate"
}
```

### Content Management Endpoints

#### GET /content
Get all content items.

**Query Parameters:**
- `type` (string): Filter by content type
- `isActive` (boolean): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "content_id",
      "key": "faq_1",
      "type": "faq",
      "title": "How to apply for a loan?",
      "content": {
        "answer": "To apply for a loan..."
      },
      "isActive": true
    }
  ]
}
```

#### POST /content
Create new content item.

**Request Body:**
```json
{
  "key": "faq_new",
  "type": "faq",
  "title": "New FAQ Question",
  "content": {
    "answer": "FAQ answer content"
  }
}
```

**Valid Content Types:**
- `faq`
- `process_guide`
- `contact_info`
- `terms`
- `privacy`
- `about`

#### PUT /content/:id
Update content item.

**Request Body:**
```json
{
  "title": "Updated title",
  "content": {
    "answer": "Updated content"
  },
  "isActive": true
}
```

#### DELETE /content/:id
Delete content item.

### Analytics Endpoints

#### GET /analytics/loans
Get loan analytics data.

**Query Parameters:**
- `period` (string): Time period (7d, 30d, 90d, 1y, default: 30d)

**Response:**
```json
{
  "success": true,
  "data": {
    "loanTrends": [
      {
        "_id": {
          "year": 2024,
          "month": 1,
          "day": 15
        },
        "count": 5,
        "totalAmount": 25000
      }
    ],
    "statusDistribution": [
      {
        "_id": "approved",
        "count": 45,
        "totalAmount": 225000
      }
    ],
    "amountDistribution": [
      {
        "_id": 1000,
        "count": 20,
        "totalAmount": 20000
      }
    ]
  }
}
```

#### GET /analytics/users
Get user analytics data.

**Query Parameters:**
- `period` (string): Time period (7d, 30d, 90d, 1y, default: 30d)

**Response:**
```json
{
  "success": true,
  "data": {
    "userGrowth": [...],
    "levelDistribution": [...],
    "registrationCompletion": [...]
  }
}
```

## Real-time Updates

The system supports real-time updates via Socket.IO. Admin applications can connect to receive live updates:

```javascript
const socket = io('http://localhost:5000');

// Listen for loan status changes
socket.on('loan-status-changed', (data) => {
  console.log('Loan status updated:', data);
});

// Listen for payment notifications
socket.on('payment-received', (data) => {
  console.log('Payment received:', data);
});
```

## Rate Limiting

API requests are rate-limited to 100 requests per 15-minute window per IP address.

## Security Considerations

1. **Authentication**: All admin endpoints require valid JWT tokens with admin privileges
2. **HTTPS**: Use HTTPS in production environments
3. **Input Validation**: All inputs are validated and sanitized
4. **Audit Trail**: Admin actions are logged with timestamps and user information
5. **Role-based Access**: Only users with admin role can access these endpoints

## Integration Examples

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const adminAPI = {
  baseURL: 'http://localhost:5000/api/admin',
  token: 'your_admin_jwt_token',
  
  async getDashboard() {
    const response = await axios.get(`${this.baseURL}/dashboard/overview`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.data;
  },
  
  async getUsers(params = {}) {
    const response = await axios.get(`${this.baseURL}/users`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      params
    });
    return response.data;
  },
  
  async updateLoanStatus(loanId, status, notes) {
    const response = await axios.patch(
      `${this.baseURL}/loans/${loanId}/status`,
      { status, adminNotes: notes },
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }
};
```

### Python Example

```python
import requests

class AdminAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_dashboard(self):
        response = requests.get(
            f'{self.base_url}/dashboard/overview',
            headers=self.headers
        )
        return response.json()
    
    def get_users(self, **params):
        response = requests.get(
            f'{self.base_url}/users',
            headers=self.headers,
            params=params
        )
        return response.json()
    
    def update_loan_status(self, loan_id, status, notes=None):
        data = {'status': status}
        if notes:
            data['adminNotes'] = notes
            
        response = requests.patch(
            f'{self.base_url}/loans/{loan_id}/status',
            headers=self.headers,
            json=data
        )
        return response.json()

# Usage
admin_api = AdminAPI('http://localhost:5000/api/admin', 'your_admin_jwt_token')
dashboard = admin_api.get_dashboard()
users = admin_api.get_users(page=1, limit=20, status='active')
```

## Support

For technical support or questions about the Admin API, please contact the development team or refer to the main project documentation.

## Changelog

### Version 1.0.0
- Initial release of Admin API
- Dashboard overview endpoint
- User management endpoints
- Loan management endpoints
- System configuration endpoints
- Content management endpoints
- Analytics endpoints
- Real-time updates via Socket.IO