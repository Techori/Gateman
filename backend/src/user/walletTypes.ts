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
