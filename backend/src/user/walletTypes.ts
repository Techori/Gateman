export interface Wallet {
    _id: string;
    userId: string;
    balance: number;
    transactions: WalletTransaction[];
    createdAt: Date;
    updatedAt: Date;
    formattedBalance: string;
    
    // Methods
    creditAmount(
        amount: number, 
        description: string, 
        transactionId?: string,
        gstAmount?: number,
        discountAmount?: number,
        originalAmount?: number,
        paymentGatewayResponse?: any
    ): WalletTransaction;
    
    debitAmount(
        amount: number, 
        description: string, 
        rentalId?: string,
        gstAmount?: number
    ): WalletTransaction;
    
    hasSufficientBalance(amount: number): boolean;
    getTransactionHistory(limit?: number, skip?: number): WalletTransaction[];
    getPendingTransactions(): WalletTransaction[];
    save(): Promise<Wallet>;
}

export interface WalletTransaction {
    _id?: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    transactionId?: string;
    paymentMethod?: 'wallet_topup' | 'rental_payment' | 'refund';
    gstAmount?: number;
    discountAmount?: number;
    originalAmount?: number;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
    rentalId?: string;
    paymentGatewayResponse?: any;
}

export interface WalletTopupRequest {
    amount: number;
    paymentMethod: 'easebuzz' | 'cashfree';
}

export interface WalletPaymentResponse {
    success: boolean;
    message: string;
    data?: {
        walletBalance: number;
        transactionId: string;
        amountDebited: number;
        gstAmount?: number;
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
