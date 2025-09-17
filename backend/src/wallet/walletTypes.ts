export interface Wallet {
    _id: string;
    userId: string;
    balance: number;
    status: 'active' | 'inactive' | 'blocked';
    transactions: WalletTransaction[];
    createdAt: Date;
    updatedAt: Date;
    formattedBalance: string;
    
    // Methods
    creditAmount(
        amount: number, 
        description: string, 
        transactionId?: string,
        transactionType?: 'credit' | 'refund' | 'cashback',
        serviceId?: string,
        gstAmount?: number,
        discountAmount?: number,
        originalAmount?: number,
        paymentGatewayResponse?: any
    ): WalletTransaction;
    
    debitAmount(
        amount: number, 
        description: string, 
        serviceId?: string,
        bookingId?: string,
        transactionReference?: string,
        gstAmount?: number
    ): WalletTransaction;
    
    hasSufficientBalance(amount: number): boolean;
    getTransactionHistory(limit?: number, skip?: number): WalletTransaction[];
    getPendingTransactions(): WalletTransaction[];
    processRefund(originalTransactionId: string, amount: number, reason: string): WalletTransaction;
    applyCashback(amount: number, reason: string): WalletTransaction;
    blockWallet(reason: string): void;
    unblockWallet(): void;
    save(): Promise<Wallet>;
}

export interface WalletTransaction {
    _id?: string;
    walletId: string;
    transactionType: 'credit' | 'debit' | 'refund' | 'cashback';
    amount: number;
    description: string;
    transactionReference?: string; // UPI TXN ID / Razorpay Order ID / Internal Reference
    status: 'success' | 'pending' | 'failed';
    serviceId?: string; // Reference to services table
    bookingId?: string; // Reference to booking/rental
    gstAmount?: number;
    discountAmount?: number;
    originalAmount?: number;
    createdAt: Date;
    paymentGatewayResponse?: any;
    refundReason?: string;
    cashbackRuleId?: string;
}

export interface Service {
    _id: string;
    name: string; // Seat Booking, Meeting Room, Café, Printing, Parking, Event
    price: number;
    vendorId?: string; // Reference to users table if vendor
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface WalletCashbackRule {
    _id: string;
    minAmount: number;
    cashbackAmount: number;
    cashbackType: 'fixed' | 'percentage';
    maxCashback?: number; // For percentage type
    serviceType?: string; // If cashback is specific to service type
    validFrom: Date;
    validTo: Date;
    status: 'active' | 'inactive';
    description: string;
    usageLimit?: number; // How many times this rule can be used per user
    createdAt: Date;
    updatedAt: Date;
}

export interface WalletTopupRequest {
    amount: number;
    paymentMethod: 'easebuzz' | 'cashfree';
}

export interface WalletPaymentRequest {
    serviceId: string;
    amount: number;
    description: string;
    bookingId?: string;
}

export interface WalletRefundRequest {
    originalTransactionId: string;
    refundAmount: number;
    reason: string;
    adminApproval?: boolean;
}

export interface WalletPaymentResponse {
    success: boolean;
    message: string;
    data?: {
        walletBalance: number;
        transactionId: string;
        amountDebited: number;
        gstAmount?: number;
        serviceDetails?: any;
    };
}

export interface TopupResponse {
    success: boolean;
    message: string;
    data?: {
        paymentUrl?: string;
        paymentData?: any;
        transactionId: string;
        finalAmount: number;
        discountAmount: number;
        gstAmount: number;
    };
}

export interface WalletSummary {
    totalUsers: number;
    totalWalletBalance: number;
    totalTransactions: number;
    recentTransactions: WalletTransaction[];
    topUsers: Array<{
        userId: string;
        userName: string;
        balance: number;
        transactionCount: number;
    }>;
}

export interface AdminWalletActions {
    approveRefund: (transactionId: string, adminId: string) => Promise<boolean>;
    rejectRefund: (transactionId: string, adminId: string, reason: string) => Promise<boolean>;
    adjustBalance: (userId: string, amount: number, reason: string, adminId: string) => Promise<boolean>;
    blockWallet: (userId: string, reason: string, adminId: string) => Promise<boolean>;
    unblockWallet: (userId: string, adminId: string) => Promise<boolean>;
}

// Auto-Debit related interfaces
export interface WalletAutoDebitMandate {
    _id: string;
    userId: string;
    serviceId: string;
    amount: number;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    customFrequencyDays?: number; // For custom frequency
    nextDueDate: Date;
    status: 'active' | 'paused' | 'cancelled' | 'suspended';
    maxAmount?: number; // Maximum amount that can be debited
    authorizationMethod: 'checkbox' | 'otp' | 'digital_signature';
    authorizationToken?: string; // OTP or digital signature token
    failureRetryCount: number;
    maxRetryCount: number;
    graceLastNotified?: Date;
    createdAt: Date;
    updatedAt: Date;
    
    // Methods
    canDebit(): boolean;
    calculateNextDueDate(): Date;
    incrementRetryCount(): void;
    resetRetryCount(): void;
    pause(): void;
    resume(): void;
    cancel(): void;
    suspend(): void;
    save(): Promise<WalletAutoDebitMandate>;
}

export interface WalletAutoDebitLog {
    _id: string;
    mandateId: string;
    debitDate: Date;
    amount: number;
    status: 'success' | 'failed' | 'pending' | 'retry';
    retryCount: number;
    failureReason?: string;
    transactionId?: string; // Link to wallet transaction
    systemTriggered: boolean; // true for cron, false for manual
    triggeredBy?: string; // admin user ID if manual
    createdAt: Date;
}

export interface CreateAutoDebitMandateRequest {
    serviceId: string;
    amount: number;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    customFrequencyDays?: number;
    authorizationMethod: 'checkbox' | 'otp';
    authorizationToken?: string; // OTP for verification
    maxAmount?: number;
    startDate?: Date; // When to start the auto-debit
}

export interface AutoDebitResponse {
    success: boolean;
    message: string;
    data?: {
        mandateId: string;
        nextDueDate: Date;
        amount: number;
        frequency: string;
    };
}

export interface AutoDebitMandateAction {
    mandateId: string;
    action: 'pause' | 'resume' | 'cancel';
    reason?: string;
}

export interface AdminAutoDebitSummary {
    totalActiveMandates: number;
    totalPausedMandates: number;
    totalCancelledMandates: number;
    todaySuccessfulDebits: number;
    todayFailedDebits: number;
    recentLogs: WalletAutoDebitLog[];
    pendingRetries: number;
}
