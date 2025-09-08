# Auto-Debit Module API Documentation

## Overview
The Auto-Debit Module allows automatic deduction of wallet balance for recurring subscriptions, scheduled bookings, and services with fixed billing. This ensures a cashless, seamless experience for users.

## API Base URL
```
http://localhost:3000/api/v1/wallet/autodebit
```

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## User Endpoints

### 1. Create Auto-Debit Mandate
**POST** `/create`

Creates a new auto-debit mandate for a user.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "serviceId": "673abc123def456789012345",
  "amount": 1500.00,
  "frequency": "monthly",
  "customFrequencyDays": null,
  "authorizationMethod": "checkbox",
  "authorizationToken": "optional_otp_token",
  "maxAmount": 2000.00,
  "startDate": "2025-09-15T00:00:00.000Z"
}
```

**Request Parameters:**
- `serviceId` (string, required): ID of the service to subscribe to
- `amount` (number, required): Amount to be debited per cycle
- `frequency` (string, required): Frequency of debit (`daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `custom`)
- `customFrequencyDays` (number, optional): Required when frequency is `custom`
- `authorizationMethod` (string, required): Authorization method (`checkbox`, `otp`)
- `authorizationToken` (string, optional): OTP token if authorization method is `otp`
- `maxAmount` (number, optional): Maximum amount that can be debited
- `startDate` (string, optional): When to start the auto-debit (ISO date string)

**Response:**
```json
{
  "success": true,
  "message": "Auto-debit mandate created successfully",
  "data": {
    "mandateId": "673def456789012345678901",
    "nextDueDate": "2025-10-15T00:00:00.000Z",
    "amount": 1500.00,
    "frequency": "monthly"
  }
}
```

### 2. Get User Mandates
**GET** `/:userId`

Retrieves all auto-debit mandates for a specific user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `userId` (string): User ID (can be omitted if accessing own data)

**Response:**
```json
{
  "success": true,
  "message": "Mandates retrieved successfully",
  "data": {
    "mandates": [
      {
        "_id": "673def456789012345678901",
        "userId": "673abc123def456789012345",
        "serviceId": {
          "_id": "673abc123def456789012345",
          "name": "Seat Booking",
          "price": 1500
        },
        "amount": 1500.00,
        "frequency": "monthly",
        "nextDueDate": "2025-10-15T00:00:00.000Z",
        "status": "active",
        "failureRetryCount": 0,
        "maxRetryCount": 3,
        "createdAt": "2025-09-15T00:00:00.000Z",
        "updatedAt": "2025-09-15T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

### 3. Update Mandate Status
**POST** `/update-status`

Updates the status of an auto-debit mandate (pause, resume, cancel).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "mandateId": "673def456789012345678901",
  "action": "pause",
  "reason": "Optional reason for the action"
}
```

**Request Parameters:**
- `mandateId` (string, required): ID of the mandate to update
- `action` (string, required): Action to perform (`pause`, `resume`, `cancel`)
- `reason` (string, optional): Reason for the action

**Response:**
```json
{
  "success": true,
  "message": "Mandate paused successfully"
}
```

### 4. Pause Mandate
**POST** `/pause`

Convenience endpoint to pause a mandate.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "mandateId": "673def456789012345678901"
}
```

### 5. Resume Mandate
**POST** `/resume`

Convenience endpoint to resume a paused mandate.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "mandateId": "673def456789012345678901"
}
```

### 6. Cancel Mandate
**POST** `/cancel`

Convenience endpoint to cancel a mandate.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "mandateId": "673def456789012345678901"
}
```

### 7. Get Mandate Logs
**GET** `/logs/:mandateId`

Retrieves transaction logs for a specific mandate.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `mandateId` (string): ID of the mandate

**Query Parameters:**
- `limit` (number, optional): Number of logs to retrieve (default: 50)

**Response:**
```json
{
  "success": true,
  "message": "Mandate logs retrieved successfully",
  "data": {
    "logs": [
      {
        "_id": "673def456789012345678902",
        "mandateId": "673def456789012345678901",
        "debitDate": "2025-09-15T09:00:00.000Z",
        "amount": 1500.00,
        "status": "success",
        "retryCount": 0,
        "transactionId": "673def456789012345678903",
        "systemTriggered": true,
        "createdAt": "2025-09-15T09:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

## System Endpoints

### 8. Run Auto-Debit Cron
**POST** `/run`

Endpoint for cron jobs to process due auto-debits.

**Headers:**
```
Authorization: Bearer <cron_secret_token>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-debit processing completed",
  "data": {
    "processed": 25,
    "successful": 23,
    "failed": 2,
    "details": [
      {
        "mandateId": "673def456789012345678901",
        "status": "success"
      },
      {
        "mandateId": "673def456789012345678904",
        "status": "failed",
        "reason": "Insufficient balance"
      }
    ]
  }
}
```

## Admin Endpoints

### 9. Get All Mandates (Admin)
**GET** `/admin/mandates`

Retrieves all auto-debit mandates with pagination (admin only).

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `status` (string, optional): Filter by status (`active`, `paused`, `cancelled`, `suspended`)
- `userId` (string, optional): Filter by user ID

**Response:**
```json
{
  "success": true,
  "message": "Mandates retrieved successfully",
  "data": {
    "mandates": [
      {
        "_id": "673def456789012345678901",
        "userId": {
          "_id": "673abc123def456789012345",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "serviceId": {
          "_id": "673abc123def456789012345",
          "name": "Seat Booking"
        },
        "amount": 1500.00,
        "frequency": "monthly",
        "status": "active",
        "nextDueDate": "2025-10-15T00:00:00.000Z",
        "failureRetryCount": 0
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

### 10. Get Admin Summary
**GET** `/admin/summary`

Gets auto-debit statistics and summary for admin dashboard.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Admin summary retrieved successfully",
  "data": {
    "totalActiveMandates": 120,
    "totalPausedMandates": 25,
    "totalCancelledMandates": 5,
    "todaySuccessfulDebits": 87,
    "todayFailedDebits": 3,
    "pendingRetries": 2,
    "recentLogs": [
      {
        "_id": "673def456789012345678902",
        "mandateId": "673def456789012345678901",
        "debitDate": "2025-09-15T09:00:00.000Z",
        "amount": 1500.00,
        "status": "success"
      }
    ]
  }
}
```

### 11. Force Run Mandate (Admin)
**POST** `/admin/force-run`

Manually trigger auto-debit for a specific mandate (admin only).

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "mandateId": "673def456789012345678901"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-debit processed successfully"
}
```

### 12. Get All Logs (Admin)
**GET** `/admin/logs`

Retrieves all auto-debit logs with pagination (admin only).

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50)
- `status` (string, optional): Filter by status (`success`, `failed`, `pending`, `retry`)

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created successfully
- `400`: Bad request (invalid input)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `500`: Internal server error

## Webhook Integration

For external systems that need to be notified of auto-debit events, you can implement webhook endpoints:

### Auto-Debit Success Webhook
```json
{
  "event": "autodebit.success",
  "data": {
    "mandateId": "673def456789012345678901",
    "userId": "673abc123def456789012345",
    "amount": 1500.00,
    "transactionId": "673def456789012345678903",
    "timestamp": "2025-09-15T09:00:00.000Z"
  }
}
```

### Auto-Debit Failed Webhook
```json
{
  "event": "autodebit.failed",
  "data": {
    "mandateId": "673def456789012345678901",
    "userId": "673abc123def456789012345",
    "amount": 1500.00,
    "reason": "Insufficient balance",
    "retryCount": 1,
    "timestamp": "2025-09-15T09:00:00.000Z"
  }
}
```

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Auto-debit cron job secret token
CRON_SECRET_TOKEN=your-secure-cron-token-here
```

## Cron Job Schedule

The auto-debit system runs the following cron jobs:

1. **Daily Auto-Debit Processing**: Runs every day at 9:00 AM
   - Cron expression: `0 9 * * *`
   
2. **Hourly Retry Processing**: Runs every hour from 9 AM to 9 PM
   - Cron expression: `0 9-21 * * *`
   
3. **Pre-notification**: Runs daily at 6:00 PM for 24-hour advance notifications
   - Cron expression: `0 18 * * *`

## Testing

You can test the auto-debit functionality using the provided endpoints. Make sure to:

1. Create a user with an active wallet
2. Create a service that supports auto-debit
3. Create an auto-debit mandate
4. Trigger the cron job manually or wait for the scheduled time
5. Check the mandate logs to verify the transaction

## Notes

- All amounts are in the base currency (INR)
- Timestamps are in ISO 8601 format
- The system automatically retries failed debits up to 3 times
- Mandates are suspended after 3 consecutive failures
- Users can pause/resume their mandates at any time
- Admin can force-run any mandate manually
