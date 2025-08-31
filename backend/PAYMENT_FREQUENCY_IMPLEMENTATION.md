# Payment Frequency Implementation Guide

## Overview
The rental system now supports flexible payment frequencies for automatic rent collection using NACH/UPI mandates through Digio integration. Users can choose from:

- **Weekly (7 days)** - Rent divided by 4.33 weeks per month
- **Bi-weekly (15 days)** - Rent divided by 2 payments per month  
- **Monthly** - Traditional monthly payment (default)

## Key Features

### 🏠 **Flexible Payment Options**
- Tenants can select their preferred payment frequency when creating rental agreements
- Payment amounts are automatically calculated based on frequency
- Smart date calculations for different payment schedules

### 💰 **Automatic Payment Calculation**
```typescript
// Weekly: Monthly rent ÷ 4.33
// Bi-weekly: Monthly rent ÷ 2  
// Monthly: Monthly rent (unchanged)
```

### 📅 **Smart Scheduling**
- **Daily checks (9 AM)**: All payment types
- **Weekly checks (Mondays 9 AM)**: Weekly-specific processing
- **Bi-weekly checks**: Every 14 days at 9 AM
- **Retry logic**: Every 2 hours (9 AM - 6 PM) for failed payments

### 🔄 **Mandate Integration**
- Digio API automatically configured for different frequencies
- NACH and UPI support for all frequency types
- Proper frequency mapping to Digio's system

## Implementation Files

### Core Models (`src/rental/rentalModel.ts`)
```typescript
// New fields added:
paymentFrequency: "weekly" | "bi-weekly" | "monthly"
paymentAmount: number  // Calculated based on frequency
paidPayments: number   // Track total payments made
```

### Payment Utilities (`src/rental/paymentFrequencyUtils.ts`)
```typescript
// Key functions:
calculatePaymentAmount(monthlyRent, frequency)
calculateNextPaymentDate(currentDate, frequency)  
getDigioFrequency(frequency) // Maps to Digio API
```

### Enhanced Controller (`src/rental/rentalController.ts`)
- Validates payment frequency selection
- Calculates appropriate payment amounts
- Creates mandates with correct frequency settings
- Proper error handling for all frequency types

### Smart Scheduler (`src/rental/rentalScheduler.ts`)
- Frequency-aware payment processing
- Separate handling for weekly/bi-weekly payments
- Updated date calculations for next payment dates
- Proper mandate amount validation

## API Endpoints

### Create Agreement with Frequency
```http
POST /api/v1/rental/agreements
{
  "propertyId": "...",
  "tenantId": "...", 
  "monthlyRent": 30000,
  "paymentFrequency": "weekly", // or "bi-weekly", "monthly"
  "mandateType": "UPI",
  "upiDetails": {...}
}
```

### Test Payment Frequency
```http
GET /api/v1/rental/test/payment-frequency/weekly?monthlyRent=30000
```

Response:
```json
{
  "success": true,
  "data": {
    "frequency": "weekly",
    "monthlyRent": 30000,
    "paymentAmount": 6928, 
    "nextPaymentDate": "2024-01-15T00:00:00.000Z",
    "daysUntilNext": 7
  }
}
```

## Payment Amount Calculations

| Monthly Rent | Weekly Payment | Bi-weekly Payment | Monthly Payment |
|-------------|----------------|-------------------|-----------------|
| ₹30,000     | ₹6,928         | ₹15,000          | ₹30,000         |
| ₹50,000     | ₹11,547        | ₹25,000          | ₹50,000         |
| ₹100,000    | ₹23,094        | ₹50,000          | ₹100,000        |

## Database Schema Updates

### RentalAgreement Collection
```javascript
{
  // Existing fields...
  paymentFrequency: {
    type: String,
    enum: ["weekly", "bi-weekly", "monthly"],
    default: "monthly"
  },
  paymentAmount: {
    type: Number,
    required: true
  },
  paidPayments: {
    type: Number,
    default: 0
  }
}
```

### Mandate Collection  
```javascript
{
  // Existing fields...
  frequency: {
    type: String,
    enum: ["weekly", "bi-weekly", "monthly"],
    required: true
  },
  amount: Number // Per-payment amount, not monthly
}
```

### RentalPayment Collection
```javascript
{
  // Existing fields...
  paymentFrequency: {
    type: String,
    enum: ["weekly", "bi-weekly", "monthly"]
  }
}
```

## Scheduler Behavior

### Weekly Payments
- Processed every Monday at 9 AM
- Next payment date: +7 days from current
- Payment amount: Monthly rent ÷ 4.33

### Bi-weekly Payments  
- Processed every 14 days at 9 AM
- Next payment date: +14 days from current
- Payment amount: Monthly rent ÷ 2

### Monthly Payments
- Processed daily (existing logic)
- Next payment date: Same day next month
- Payment amount: Full monthly rent

## Error Handling

### Validation
- Payment frequency must be one of: "weekly", "bi-weekly", "monthly"
- Monthly rent must be positive number
- Mandate type must match payment method

### Fallbacks
- Defaults to "monthly" if frequency not specified
- Uses monthlyRent if paymentAmount not available
- Graceful handling of legacy agreements

## Testing

### Test Endpoint
```bash
# Test weekly frequency
curl "http://localhost:3000/api/v1/rental/test/payment-frequency/weekly?monthlyRent=30000"

# Test bi-weekly frequency  
curl "http://localhost:3000/api/v1/rental/test/payment-frequency/bi-weekly?monthlyRent=50000"

# Test monthly frequency
curl "http://localhost:3000/api/v1/rental/test/payment-frequency/monthly?monthlyRent=25000"
```

## Migration Notes

### Existing Agreements
- Legacy agreements without `paymentFrequency` default to "monthly"
- `paymentAmount` calculated from `monthlyRent` if missing
- No data migration required - system is backward compatible

### Gradual Rollout
- All existing functionality preserved
- New frequency options available for new agreements
- Existing mandates continue working unchanged

## Production Considerations

### Performance
- Efficient database queries with proper indexing
- Minimal overhead for frequency calculations
- Optimized scheduler to prevent duplicate payments

### Monitoring
- Payment frequency metrics in dashboard
- Failed payment retry logic enhanced
- Comprehensive logging for all frequency types

### Security
- Input validation for all frequency-related fields
- Safe calculation methods to prevent overflow
- Proper mandate amount validation

## Support & Troubleshooting

### Common Issues
1. **Wrong Payment Amount**: Check frequency calculation logic
2. **Missed Payments**: Verify scheduler cron expressions  
3. **Mandate Errors**: Ensure Digio frequency mapping is correct

### Debug Tools
- Test endpoint for frequency calculations
- Payment history shows frequency information
- Scheduler status includes frequency-specific metrics

---

*Implementation completed successfully with full TypeScript compliance and comprehensive error handling.*
