# Wallet System API Documentation

## Overview
The Wallet System provides a comprehensive digital prepaid account solution for the Co-working Space platform. It enables cashless transactions for various services like seat booking, meeting rooms, café, printing, parking, and events.

## Features Implemented

### Core Wallet Features
- **Wallet Creation**: Auto-created on user registration with unique Wallet ID
- **Wallet Funding**: Support for UPI, Cards, Net Banking via EaseBuzz/Cashfree
- **Wallet Usage**: Real-time deduction for bookings & services
- **Instant Refunds**: Direct refunds to wallet
- **Cashback & Loyalty**: Configurable cashback rules and bonus system
- **Security**: Transaction-level tracking and wallet status management

### User Roles
1. **User**: Load money, spend on services, request refunds
2. **Admin**: Monitor wallets, approve transactions, generate reports, manage services
3. **Vendor**: Provide services and receive settlements

## Database Schema

### Wallets Collection
```typescript
{
  _id: ObjectId,
  userId: String (ref: User),
  balance: Number (min: 0),
  status: 'active' | 'inactive' | 'blocked',
  transactions: [WalletTransaction],
  createdAt: Date,
  updatedAt: Date
}
```

### Wallet Transactions (Embedded)
```typescript
{
  _id: ObjectId,
  walletId: String,
  transactionType: 'credit' | 'debit' | 'refund' | 'cashback',
  amount: Number,
  description: String,
  transactionReference: String (unique),
  status: 'success' | 'pending' | 'failed',
  serviceId: String (ref: Service),
  bookingId: String (ref: Rental),
  gstAmount: Number,
  discountAmount: Number,
  originalAmount: Number,
  paymentGatewayResponse: Mixed,
  refundReason: String,
  cashbackRuleId: String (ref: WalletCashbackRule),
  createdAt: Date
}
```

### Services Collection
```typescript
{
  _id: ObjectId,
  name: 'Seat Booking' | 'Meeting Room' | 'Café' | 'Printing' | 'Parking' | 'Event',
  price: Number,
  vendorId: String (ref: User),
  description: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Wallet Cashback Rules Collection
```typescript
{
  _id: ObjectId,
  minAmount: Number,
  cashbackAmount: Number,
  cashbackType: 'fixed' | 'percentage',
  maxCashback: Number,
  serviceType: String,
  validFrom: Date,
  validTo: Date,
  status: 'active' | 'inactive',
  description: String,
  usageLimit: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Wallet Management APIs

#### 1. Get Wallet Details
```
GET /api/v1/wallet
Authorization: Bearer <token>
```
**Response:**
```json
{
  "success": true,
  "message": "Wallet details fetched successfully",
  "data": {
    "walletId": "wallet_id",
    "balance": 1500.00,
    "formattedBalance": "₹1,500.00",
    "status": "active",
    "transactions": [...],
    "totalTransactions": 25,
    "canTransact": true
  }
}
```

#### 2. Wallet Topup
```
POST /api/v1/wallet/topup
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1000,
  "paymentMethod": "easebuzz"
}
```

#### 3. Process Service Payment
```
POST /api/v1/wallet/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "serviceId": "service_id",
  "amount": 250,
  "description": "Seat booking payment",
  "bookingId": "booking_id"
}
```

#### 4. Check Payment Capability
```
GET /api/v1/wallet/can-pay?amount=500
Authorization: Bearer <token>
```

#### 5. Request Refund
```
POST /api/v1/wallet/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "originalTransactionId": "transaction_id",
  "refundAmount": 200,
  "reason": "Booking cancelled"
}
```

#### 6. Get Transaction History
```
GET /api/v1/wallet/transactions?page=1&limit=20&type=credit&status=success
Authorization: Bearer <token>
```

### Payment Gateway Callbacks

#### 7. Topup Success Callback
```
POST /api/v1/wallet/topup/success
Content-Type: application/json

{
  "txnid": "transaction_id",
  "status": "success",
  "amount": "900.00",
  "easepayid": "easebuzz_payment_id"
}
```

#### 8. Topup Failure Callback
```
POST /api/v1/wallet/topup/failure
Content-Type: application/json

{
  "txnid": "transaction_id",
  "status": "failure",
  "error": "Payment failed"
}
```

### Admin APIs

#### 9. Get All Wallets
```
GET /api/v1/wallet/admin/wallets?page=1&limit=50&status=active&minBalance=100
Authorization: Bearer <admin_token>
```

#### 10. Get All Transactions
```
GET /api/v1/wallet/admin/transactions?page=1&limit=50&type=debit&fromDate=2024-01-01
Authorization: Bearer <admin_token>
```

#### 11. Get Wallet Summary
```
GET /api/v1/wallet/admin/summary
Authorization: Bearer <admin_token>
```

#### 12. Update Wallet Status
```
PUT /api/v1/wallet/admin/wallets/:walletId/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "blocked",
  "reason": "Suspicious activity"
}
```

#### 13. Adjust Wallet Balance
```
POST /api/v1/wallet/admin/wallets/:walletId/adjust
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "amount": 500,
  "adjustmentType": "credit",
  "reason": "Compensation for service issue"
}
```

### Service Management APIs

#### 14. Get All Services
```
GET /api/v1/services?isActive=true
```

#### 15. Get Service by ID
```
GET /api/v1/services/:serviceId
```

#### 16. Create Service (Admin)
```
POST /api/v1/services
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Meeting Room",
  "price": 500,
  "vendorId": "vendor_user_id",
  "description": "Conference room booking"
}
```

#### 17. Update Service (Admin)
```
PUT /api/v1/services/:serviceId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "price": 600,
  "isActive": true
}
```

#### 18. Delete Service (Admin)
```
DELETE /api/v1/services/:serviceId
Authorization: Bearer <admin_token>
```

### Cashback Rules Management

#### 19. Get All Cashback Rules (Admin)
```
GET /api/v1/services/admin/cashback-rules?status=active
Authorization: Bearer <admin_token>
```

#### 20. Create Cashback Rule (Admin)
```
POST /api/v1/services/admin/cashback-rules
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "minAmount": 1000,
  "cashbackAmount": 5,
  "cashbackType": "percentage",
  "maxCashback": 100,
  "serviceType": "All",
  "validFrom": "2024-01-01",
  "validTo": "2024-12-31",
  "description": "5% cashback on all purchases above ₹1000",
  "usageLimit": null
}
```

#### 21. Update Cashback Rule (Admin)
```
PUT /api/v1/services/admin/cashback-rules/:ruleId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "inactive"
}
```

#### 22. Delete Cashback Rule (Admin)
```
DELETE /api/v1/services/admin/cashback-rules/:ruleId
Authorization: Bearer <admin_token>
```

## Transaction Flow

### 1. User Registration Flow
1. User registers → Wallet auto-created with ₹0 balance
2. User receives unique Wallet ID
3. Wallet status set to 'active'

### 2. Wallet Loading Flow
1. User initiates topup with amount and payment method
2. System calculates final amount (with GST and discount)
3. Payment gateway integration (EaseBuzz/Cashfree)
4. On successful payment → Balance updated + Cashback applied (if applicable)
5. On failed payment → Transaction marked as failed

### 3. Service Payment Flow
1. User selects service and initiates payment
2. System checks wallet balance and status
3. If sufficient balance → Amount deducted + Transaction logged
4. Service provider receives settlement
5. Cashback applied based on applicable rules

### 4. Refund Flow
1. User/Admin initiates refund request
2. System validates original transaction
3. Instant refund processed to wallet
4. Balance updated immediately

### 5. Admin Settlement Flow
1. Admin reviews vendor transactions
2. Calculates vendor earnings
3. Processes settlements to vendor accounts
4. Maintains transaction audit trail

## Security Features

### 1. Transaction Security
- Unique transaction references for all transactions
- Real-time balance validation
- Transaction status tracking (pending/success/failed)
- Audit trail for all wallet operations

### 2. Wallet Security
- Wallet status management (active/inactive/blocked)
- Admin controls for wallet operations
- Balance adjustment logging
- Fraud detection capabilities

### 3. Access Control
- Role-based access (User/Admin/Vendor)
- JWT token authentication
- Admin-only operations protection
- API rate limiting

## Configuration

### Environment Variables
```env
# Payment Gateway (EaseBuzz)
EASEBUZZ_KEY=your_easebuzz_key
EASEBUZZ_SALT=your_easebuzz_salt
EASEBUZZ_ENV=test|prod

# Payment Gateway (Cashfree)
CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key
CASHFREE_ENV=test|prod

# Frontend URLs
FRONTEND_DOMAIN=http://localhost:3000
```

### Business Rules
- Minimum topup amount: ₹200
- Wallet discount on topup: 10%
- GST rate: 18%
- Maximum wallet balance: No limit
- Refund processing: Instant to wallet
- Withdrawal: Not allowed (as per requirements)

## Error Codes

### Common Error Responses
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (Invalid input)
- `401`: Unauthorized (Invalid token)
- `403`: Forbidden (Insufficient permissions)
- `404`: Not Found (Resource doesn't exist)
- `500`: Internal Server Error

## Testing

### Test Data
1. **Test User**: Create user with wallet
2. **Test Services**: Seed services for testing payments
3. **Test Cashback Rules**: Create rules for cashback testing
4. **Payment Gateway**: Use test credentials for payment testing

### Test Scenarios
1. User registration and wallet creation
2. Wallet topup with success/failure scenarios
3. Service payments with insufficient/sufficient balance
4. Refund processing
5. Admin wallet management
6. Cashback rule application
7. Transaction history and filtering

This comprehensive wallet system provides a complete solution for digital payments in the co-working space platform with robust admin controls, security features, and scalability.
