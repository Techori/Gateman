# 🏦 Wallet Functionality Implementation Guide

## Overview

This implementation provides a comprehensive wallet system for the rental platform with the following key features:

- **Wallet Top-up with 10% Discount + 18% GST**
- **Smart Rental Payment Logic**
- **Minimum Top-up Enforcement (₹200)**
- **Duration-based Payment Rules**
- **GST Integration**

## 🎯 Key Features

### 1. Wallet Top-up System
- **Minimum Amount**: ₹200
- **Discount**: 10% discount on all wallet top-ups
- **GST**: 18% GST applied on discounted amount
- **Credit**: User gets full original amount in wallet
- **Payment Methods**: Easebuzz, Cashfree

#### Pricing Logic Example:
```
Original Amount: ₹1000
Discount (10%): ₹100
Discounted Amount: ₹900
GST (18%): ₹162
Final Payment: ₹1062
Wallet Credit: ₹1000 (full original amount)
User Savings: ₹38
```

### 2. Smart Rental Payment Logic

#### Short-term Rentals (< 7 days or hourly)
- **Primary**: Wallet payment preferred
- **Fallback**: Payment gateway if insufficient balance
- **GST**: 18% included in all payments

#### Long-term Rentals (≥ 7 days)
- **Options**: Both wallet and payment gateway available
- **Choice**: User can select preferred payment method
- **GST**: 18% included in all payments

### 3. Duration-based Rules

| Duration | Payment Logic | Enforcement |
|----------|---------------|-------------|
| ≤ 24 hours | Wallet Only | Strict |
| 1-6 days | Wallet Preferred | Flexible |
| ≥ 7 days | User Choice | Flexible |

## 📁 File Structure

```
src/
├── user/
│   ├── walletTypes.ts          # TypeScript interfaces
│   ├── walletModel.ts          # Mongoose schema & methods
│   ├── walletController.ts     # API controllers
│   └── walletRoute.ts          # Express routes
├── rental/
│   └── walletRentalService.ts  # Rental payment integration
└── app.ts                      # Route registration
```

## 🔄 API Endpoints

### Wallet Management

#### Get Wallet Details
```http
GET /api/v1/wallet
Authorization: Bearer <token>
```

**Response:**
```json
{
    "success": true,
    "message": "Wallet details fetched successfully",
    "data": {
        "balance": 5000,
        "formattedBalance": "₹5000.00",
        "transactions": [...],
        "totalTransactions": 15
    }
}
```

#### Initiate Wallet Top-up
```http
POST /api/v1/wallet/topup
Content-Type: application/json
Authorization: Bearer <token>

{
    "amount": 1000,
    "paymentMethod": "easebuzz"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Wallet topup initiated successfully",
    "data": {
        "transactionId": "WALLET_1234567890_ABC12345",
        "finalAmount": 1062,
        "discountAmount": 100,
        "gstAmount": 162,
        "paymentUrl": "https://testpay.easebuzz.in/payment/initiateLink",
        "paymentData": {...}
    }
}
```

#### Get Transaction History
```http
GET /api/v1/wallet/transactions?page=1&limit=20&type=credit
Authorization: Bearer <token>
```

### Rental Payment Integration

#### Check Payment Options
```http
GET /api/v1/rental/agreements/{agreementId}/payment-options
Authorization: Bearer <token>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "walletEligible": true,
        "gatewayRequired": false,
        "isShortTerm": true,
        "isHourly": false,
        "totalAmountWithGST": 5900,
        "paymentOptions": ["wallet", "gateway"]
    }
}
```

#### Process Rental Payment
```http
POST /api/v1/rental/agreements/{agreementId}/payments
Content-Type: application/json
Authorization: Bearer <token>

{
    "paymentPreference": "wallet_only",
    "paymentMonth": 12,
    "paymentYear": 2024
}
```

**Response:**
```json
{
    "success": true,
    "message": "Payment successful via wallet. ₹5900.00 debited.",
    "data": {
        "paymentMethod": "wallet",
        "walletPayment": {
            "success": true,
            "data": {
                "walletBalance": 4100,
                "transactionId": "...",
                "amountDebited": 5900,
                "gstAmount": 900
            }
        }
    }
}
```

## 💾 Database Models

### Wallet Model
```typescript
{
    userId: ObjectId,           // Reference to User
    balance: Number,            // Current wallet balance
    transactions: [             // Array of transactions
        {
            type: 'credit' | 'debit',
            amount: Number,
            description: String,
            transactionId: String,
            paymentMethod: String,
            gstAmount: Number,
            discountAmount: Number,
            originalAmount: Number,
            status: 'pending' | 'completed' | 'failed',
            createdAt: Date,
            rentalId?: ObjectId,
            paymentGatewayResponse?: Object
        }
    ],
    createdAt: Date,
    updatedAt: Date
}
```

### Enhanced User Model
```typescript
{
    // ... existing fields
    walletBalance: Number       // Quick reference (synced with Wallet model)
}
```

## 🔧 Core Functions

### Wallet Controller Functions

1. **`getWalletDetails()`** - Fetch wallet balance and transactions
2. **`initiateWalletTopup()`** - Start topup process with discount calculation
3. **`handleTopupSuccess()`** - Process successful payment callback
4. **`handleTopupFailure()`** - Handle failed payment callback
5. **`processRentalPayment()`** - Debit from wallet for rentals
6. **`getTransactionHistory()`** - Paginated transaction history

### Rental Service Functions

1. **`processEnhancedRentalPayment()`** - Smart payment processing
2. **`checkRentalPaymentOptions()`** - Analyze available payment methods
3. **`calculateRentalDuration()`** - Determine rental type and rules

## ⚙️ Configuration

### Environment Variables
```env
# Payment Gateway
EASEBUZZ_KEY=your_easebuzz_key
EASEBUZZ_SALT=your_easebuzz_salt
EASEBUZZ_ENV=test|prod

# Application
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:3000
```

### Constants
```typescript
const MIN_TOPUP_AMOUNT = 200;           // Minimum wallet topup
const WALLET_DISCOUNT_PERCENT = 10;     // Wallet topup discount
const GST_PERCENT = 18;                 // GST rate
const SHORT_TERM_DAYS_THRESHOLD = 7;    // Short-term rental threshold
const HOURS_THRESHOLD = 24;             // Hourly rental threshold
```

## 🧪 Testing

### Test Scenarios

1. **Wallet Top-up Tests**
   - Minimum amount validation (₹200)
   - Discount calculation (10%)
   - GST calculation (18%)
   - Payment gateway integration

2. **Rental Payment Tests**
   - Hourly rental (< 24 hours) - Wallet only
   - Short-term rental (1-6 days) - Wallet preferred
   - Long-term rental (7+ days) - User choice
   - Insufficient balance handling

3. **GST Calculation Tests**
   - Correct GST application (18%)
   - Rounding accuracy
   - Amount breakdown validation

### Test File
Use `test-wallet-functionality.html` to test all features:
- Authentication
- Wallet operations
- Rental payment simulation
- GST calculations
- Different rental durations

## 🚀 Usage Examples

### Wallet Top-up Flow
```javascript
// 1. User wants to top-up ₹1000
const topupData = {
    amount: 1000,
    paymentMethod: 'easebuzz'
};

// 2. System calculates:
// - Discount: ₹100 (10%)
// - Discounted: ₹900
// - GST: ₹162 (18% of ₹900)
// - Final payment: ₹1062
// - Wallet credit: ₹1000

// 3. User pays ₹1062, gets ₹1000 in wallet
```

### Rental Payment Flow
```javascript
// Hourly rental (2 hours, ₹500)
const rental = {
    amount: 500,
    startDate: new Date(),
    endDate: new Date(Date.now() + 2 * 60 * 60 * 1000)
};

// System logic:
// - Duration: 2 hours (< 24 hours)
// - Rule: Wallet payment required
// - Total with GST: ₹590 (₹500 + 18%)
// - Payment: Wallet only
```

## 🔒 Security Features

1. **Authentication Required** - All wallet operations require valid JWT token
2. **User Authorization** - Users can only access their own wallet
3. **Transaction Validation** - Prevent duplicate payments
4. **Balance Checks** - Prevent overspending
5. **Audit Trail** - Complete transaction history

## 📊 Business Benefits

1. **User Incentive** - 10% discount encourages wallet usage
2. **Cash Flow** - Prepaid wallet model improves cash flow
3. **Reduced Fees** - Lower payment gateway fees for wallet transactions
4. **Better UX** - Faster checkout for frequent users
5. **Flexible Payments** - Multiple options based on rental duration

## 🔄 Integration Points

### With Existing Systems
1. **User Management** - Extends existing user model
2. **Rental System** - Integrates with rental agreements
3. **Payment Gateways** - Works with Easebuzz, Cashfree
4. **Notification System** - Can trigger payment confirmations

### Future Enhancements
1. **Wallet Transfer** - P2P wallet transfers
2. **Cashback System** - Reward frequent users
3. **Auto Top-up** - Automatic balance maintenance
4. **Partial Payments** - Split between wallet and gateway
5. **Loyalty Program** - Tiered benefits based on usage

## 📝 Error Handling

Common error scenarios and responses:

1. **Insufficient Balance**
   ```json
   {
       "success": false,
       "message": "Insufficient wallet balance. Available: ₹100, Required: ₹590"
   }
   ```

2. **Minimum Top-up Violation**
   ```json
   {
       "success": false,
       "message": "Minimum topup amount is ₹200"
   }
   ```

3. **Invalid Payment Method**
   ```json
   {
       "success": false,
       "message": "Invalid payment method. Supported methods: easebuzz, cashfree"
   }
   ```

## 🎨 Frontend Integration

The implementation includes a comprehensive test HTML file that demonstrates:

- Wallet balance display
- Top-up functionality with calculation preview
- Rental payment options based on duration
- Transaction history
- Test scenarios for different use cases

This provides a complete reference for frontend developers to integrate the wallet functionality into their applications.

---

**Note**: This implementation provides a solid foundation for a wallet-based payment system with smart rental logic, GST compliance, and user-friendly features. The modular design allows for easy customization and future enhancements.
