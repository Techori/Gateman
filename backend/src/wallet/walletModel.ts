import mongoose from "mongoose";
import type { Wallet, WalletTransaction } from "./walletTypes.js";

// Wallet Transaction Schema
const walletTransactionSchema = new mongoose.Schema<WalletTransaction>(
    {
        walletId: {
            type: String,
            required: true,
            ref: "Wallet",
        },
        transactionType: {
            type: String,
            enum: ['credit', 'debit', 'refund', 'cashback'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            required: true,
            maxlength: 500,
        },
        transactionReference: {
            type: String,
            unique: true,
            sparse: true,
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed'],
            default: 'pending',
        },
        serviceId: {
            type: String,
            ref: "Service",
        },
        bookingId: {
            type: String,
            ref: "Rental",
        },
        gstAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        originalAmount: {
            type: Number,
            min: 0,
        },
        paymentGatewayResponse: {
            type: mongoose.Schema.Types.Mixed,
        },
        refundReason: {
            type: String,
            maxlength: 200,
        },
        cashbackRuleId: {
            type: String,
            ref: "WalletCashbackRule",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

// Wallet Schema
const walletSchema = new mongoose.Schema<Wallet>(
    {
        userId: {
            type: String,
            ref: "User",
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'blocked'],
            default: 'active',
        },
        transactions: {
            type: [walletTransactionSchema],
            default: [],
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for better performance
walletSchema.index({ userId: 1 });
walletSchema.index({ status: 1 });
walletSchema.index({ "transactions.transactionReference": 1 });
walletSchema.index({ "transactions.status": 1 });
walletSchema.index({ "transactions.createdAt": -1 });
walletSchema.index({ "transactions.transactionType": 1 });

// Virtual for formatted balance
walletSchema.virtual('formattedBalance').get(function() {
    return `₹${this.balance.toFixed(2)}`;
});

// Method to add money to wallet (credit, refund, cashback)
walletSchema.methods.creditAmount = function(
    amount: number, 
    description: string, 
    transactionReference?: string,
    transactionType: 'credit' | 'refund' | 'cashback' = 'credit',
    serviceId?: string,
    gstAmount = 0,
    discountAmount = 0,
    originalAmount?: number,
    paymentGatewayResponse?: any
) {
    const transaction: any = {
        walletId: this._id.toString(),
        transactionType,
        amount,
        description,
        gstAmount,
        discountAmount,
        originalAmount: originalAmount || amount,
        status: 'success',
        createdAt: new Date(),
    };

    if (transactionReference) {
        transaction.transactionReference = transactionReference;
    }

    if (serviceId) {
        transaction.serviceId = serviceId;
    }

    if (paymentGatewayResponse) {
        transaction.paymentGatewayResponse = paymentGatewayResponse;
    }

    this.transactions.push(transaction);
    this.balance += amount;
    
    return transaction;
};

// Method to deduct money from wallet
walletSchema.methods.debitAmount = function(
    amount: number, 
    description: string, 
    serviceId?: string,
    bookingId?: string,
    transactionReference?: string,
    gstAmount = 0
) {
    if (this.balance < amount) {
        throw new Error('Insufficient wallet balance');
    }

    if (this.status !== 'active') {
        throw new Error('Wallet is not active');
    }

    const transaction: any = {
        walletId: this._id.toString(),
        transactionType: 'debit',
        amount,
        description,
        gstAmount,
        status: 'success',
        createdAt: new Date(),
    };

    if (serviceId) {
        transaction.serviceId = serviceId;
    }

    if (bookingId) {
        transaction.bookingId = bookingId;
    }

    if (transactionReference) {
        transaction.transactionReference = transactionReference;
    }

    this.transactions.push(transaction);
    this.balance -= amount;
    
    return transaction;
};

// Method to process refund
walletSchema.methods.processRefund = function(
    originalTransactionId: string,
    amount: number,
    reason: string
) {
    const originalTransaction = this.transactions.find((t: WalletTransaction) => 
        t._id?.toString() === originalTransactionId || t.transactionReference === originalTransactionId
    );

    if (!originalTransaction) {
        throw new Error('Original transaction not found');
    }

    if (originalTransaction.transactionType !== 'debit') {
        throw new Error('Can only refund debit transactions');
    }

    const refundTransaction = this.creditAmount(
        amount,
        `Refund: ${reason}`,
        `REFUND_${Date.now()}_${originalTransactionId}`,
        'refund'
    );

    refundTransaction.refundReason = reason;
    
    return refundTransaction;
};

// Method to apply cashback
walletSchema.methods.applyCashback = function(amount: number, reason: string, cashbackRuleId?: string) {
    const cashbackTransaction = this.creditAmount(
        amount,
        `Cashback: ${reason}`,
        `CASHBACK_${Date.now()}_${this.userId}`,
        'cashback'
    );

    if (cashbackRuleId) {
        cashbackTransaction.cashbackRuleId = cashbackRuleId;
    }
    
    return cashbackTransaction;
};

// Method to block wallet
walletSchema.methods.blockWallet = function(reason: string) {
    this.status = 'blocked';
    // Log the blocking action
    this.creditAmount(0, `Wallet blocked: ${reason}`, `BLOCK_${Date.now()}_${this.userId}`, 'credit');
};

// Method to unblock wallet
walletSchema.methods.unblockWallet = function() {
    this.status = 'active';
    // Log the unblocking action
    this.creditAmount(0, `Wallet unblocked`, `UNBLOCK_${Date.now()}_${this.userId}`, 'credit');
};

// Method to check if sufficient balance exists
walletSchema.methods.hasSufficientBalance = function(amount: number) {
    return this.balance >= amount && this.status === 'active';
};

// Method to get transaction history
walletSchema.methods.getTransactionHistory = function(limit = 50, skip = 0) {
    return this.transactions
        .sort((a: WalletTransaction, b: WalletTransaction) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(skip, skip + limit);
};

// Method to get pending transactions
walletSchema.methods.getPendingTransactions = function() {
    return this.transactions.filter((t: WalletTransaction) => t.status === 'pending');
};

// Static method to find or create wallet
walletSchema.statics.findOrCreateWallet = async function(userId: string) {
    let wallet = await this.findOne({ userId });
    
    if (!wallet) {
        wallet = await this.create({ 
            userId, 
            balance: 0, 
            status: 'active',
            transactions: [] 
        });
    }
    
    return wallet;
};

// Define interface for the model with static methods
interface WalletModelInterface extends mongoose.Model<Wallet> {
    findOrCreateWallet(userId: string): Promise<Wallet>;
}

export const WalletModel = mongoose.model<Wallet>("Wallet", walletSchema) as WalletModelInterface;
