import mongoose from "mongoose";
import type { Wallet, WalletTransaction } from "./walletTypes.js";

// Wallet Transaction Schema
const walletTransactionSchema = new mongoose.Schema<WalletTransaction>(
    {
        type: {
            type: String,
            enum: ['credit', 'debit'],
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
        transactionId: {
            type: String,
            unique: true,
            sparse: true,
        },
        paymentMethod: {
            type: String,
            enum: ['wallet_topup', 'rental_payment', 'refund'],
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
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
        },
        rentalId: {
            type: String,
            ref: "Rental",
        },
        paymentGatewayResponse: {
            type: mongoose.Schema.Types.Mixed,
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
walletSchema.index({ "transactions.transactionId": 1 });
walletSchema.index({ "transactions.status": 1 });
walletSchema.index({ "transactions.createdAt": -1 });

// Virtual for formatted balance
walletSchema.virtual('formattedBalance').get(function() {
    return `₹${this.balance.toFixed(2)}`;
});

// Method to add money to wallet
walletSchema.methods.creditAmount = function(
    amount: number, 
    description: string, 
    transactionId?: string,
    gstAmount = 0,
    discountAmount = 0,
    originalAmount?: number,
    paymentGatewayResponse?: any
) {
    const transaction: any = {
        type: 'credit',
        amount,
        description,
        paymentMethod: 'wallet_topup',
        gstAmount,
        discountAmount,
        originalAmount: originalAmount || amount,
        status: 'completed',
        createdAt: new Date(),
    };

    if (transactionId) {
        transaction.transactionId = transactionId;
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
    rentalId?: string,
    gstAmount = 0
) {
    if (this.balance < amount) {
        throw new Error('Insufficient wallet balance');
    }

    const transaction: any = {
        type: 'debit',
        amount,
        description,
        paymentMethod: 'rental_payment',
        gstAmount,
        status: 'completed',
        createdAt: new Date(),
    };

    if (rentalId) {
        transaction.rentalId = rentalId;
    }

    this.transactions.push(transaction);
    this.balance -= amount;
    
    return transaction;
};

// Method to check if sufficient balance exists
walletSchema.methods.hasSufficientBalance = function(amount: number) {
    return this.balance >= amount;
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
        wallet = await this.create({ userId, balance: 0, transactions: [] });
    }
    
    return wallet;
};

// Define interface for the model with static methods
interface WalletModelInterface extends mongoose.Model<Wallet> {
    findOrCreateWallet(userId: string): Promise<Wallet>;
}

export const WalletModel = mongoose.model<Wallet>("Wallet", walletSchema) as WalletModelInterface;
