# CEDI Loan Backend API

A comprehensive loan management system backend built with Node.js, Express, and MongoDB. This API provides endpoints for user management, loan processing, payments, and administrative functions.

## Features

- **User Management**: Registration, authentication, profile management
- **Loan System**: Multi-level loan system with automatic progression
- **Payment Processing**: Secure payment handling and tracking
- **Admin Dashboard**: Comprehensive administrative interface
- **Real-time Updates**: Socket.IO integration for live notifications
- **Content Management**: Dynamic content system for FAQs, guides, and policies
- **Analytics**: Detailed reporting and analytics endpoints

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cedi-loan-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cedi-loan
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=30d
```

5. Start the server:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Public Endpoints

- `GET /health` - Health check
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /config` - Public configuration
- `GET /content` - Public content (FAQs, guides)

### Protected Endpoints

#### User Management
- `GET /users/profile` - Get user profile
- `PATCH /users/profile` - Update user profile
- `POST /users/complete-registration` - Complete registration

#### Loans
- `POST /loans/apply` - Apply for loan
- `GET /loans/my-loans` - Get user's loans
- `POST /loans/calculate` - Calculate loan terms
- `PATCH /loans/:id/cancel` - Cancel loan application

#### Payments
- `POST /payments/initiate` - Initiate payment
- `GET /payments/history` - Get payment history
- `POST /payments/webhook` - Payment webhook

#### Notifications
- `GET /notifications` - Get user notifications
- `PATCH /notifications/:id/read` - Mark notification as read

### Admin Endpoints

All admin endpoints require admin authentication and are prefixed with `/admin`.

#### Dashboard
- `GET /admin/dashboard/overview` - Comprehensive dashboard data

#### User Management
- `GET /admin/users` - Get all users with filtering
- `GET /admin/users/:id` - Get detailed user information
- `PATCH /admin/users/:id/status` - Update user status
- `PATCH /admin/users/:id/level` - Update user loan level

#### Loan Management
- `GET /admin/loans` - Get all loans with filtering
- `GET /admin/loans/:id` - Get detailed loan information
- `PATCH /admin/loans/:id/status` - Update loan status

#### System Configuration
- `GET /admin/config` - Get all configurations
- `PUT /admin/config/:key` - Update configuration

#### Content Management
- `GET /admin/content` - Get all content items
- `POST /admin/content` - Create content item
- `PUT /admin/content/:id` - Update content item
- `DELETE /admin/content/:id` - Delete content item

#### Analytics
- `GET /admin/analytics/loans` - Loan analytics
- `GET /admin/analytics/users` - User analytics

For detailed API documentation, see [ADMIN_API.md](./docs/ADMIN_API.md)

## Authentication

### User Authentication
Users authenticate using JWT tokens obtained through the login endpoint:

```javascript
POST /api/auth/login
{
  "email": "user@example.com",
  "pin": "1234"
}
```

### Admin Authentication
Admin users require special privileges. Include the JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Database Models

### User Model
- Personal information (name, email, phone)
- Work information (employer, salary, employment type)
- Education information
- Emergency contacts
- ID verification details
- Current loan level
- Credit score

### Loan Model
- User reference
- Loan amount and terms
- Status (pending, approved, rejected, disbursed, active, completed)
- Interest rate and fees
- Repayment schedule
- Admin notes

### Payment Model
- Loan reference
- User reference
- Amount and payment method
- Status (pending, completed, failed)
- Transaction details

### LoanLevel Model
- Level number (1-10)
- Maximum loan amount
- Interest rate
- Requirements for progression

## Real-time Features

The API supports real-time communication via Socket.IO:

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:5000');

// Join user room for targeted notifications
socket.emit('join-user-room', userId);

// Listen for loan status updates
socket.on('loan-status-changed', (data) => {
  console.log('Loan status updated:', data);
});

// Listen for payment notifications
socket.on('payment-received', (data) => {
  console.log('Payment received:', data);
});
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation and sanitization
- **CORS Configuration**: Proper CORS setup for cross-origin requests
- **Helmet**: Security headers middleware
- **Role-based Access**: Admin and user role separation

## Error Handling

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Response message",
  "data": {
    // Response data
  },
  "errors": [
    // Validation errors (if applicable)
  ]
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/cedi-loan |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRE` | JWT expiration time | 30d |
| `BCRYPT_ROUNDS` | Bcrypt hashing rounds | 12 |

## Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

## Deployment

### Production Setup

1. Set environment to production:
```env
NODE_ENV=production
```

2. Use a production MongoDB instance
3. Set secure JWT secret
4. Configure proper CORS origins
5. Use HTTPS in production

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Admin Integration Guide

For external admin applications wanting to integrate with this API:

1. **Authentication**: Obtain admin JWT token through the auth system
2. **Base URL**: Use `http://localhost:5000/api/admin` for all admin endpoints
3. **Headers**: Include `Authorization: Bearer <token>` in all requests
4. **Documentation**: Refer to [ADMIN_API.md](./docs/ADMIN_API.md) for detailed endpoint documentation
5. **Real-time**: Connect to Socket.IO for live updates

### Example Admin Integration

```javascript
const AdminAPI = {
  baseURL: 'http://localhost:5000/api/admin',
  token: 'your-admin-jwt-token',
  
  async getDashboard() {
    const response = await fetch(`${this.baseURL}/dashboard/overview`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },
  
  async updateLoanStatus(loanId, status, notes) {
    const response = await fetch(`${this.baseURL}/loans/${loanId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, adminNotes: notes })
    });
    return response.json();
  }
};
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For technical support or questions, please contact the development team or create an issue in the repository.

## Changelog

### Version 1.0.0
- Initial release
- User registration and authentication
- Multi-level loan system
- Payment processing
- Admin dashboard API
- Real-time notifications
- Content management system
- Analytics and reporting