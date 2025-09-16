import mongoose from "mongoose";
import type { WalletAutoDebitMandate, WalletAutoDebitLog } from "./walletTypes.js";

// Auto-Debit Mandate Schema
const walletAutoDebitMandateSchema = new mongoose.Schema<WalletAutoDebitMandate>(
    {
        userId: {
            type: String,
            ref: "User",
            required: true,
        },
        serviceId: {
            type: String,
            ref: "Service",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
            required: true,
        },
        customFrequencyDays: {
            type: Number,
            min: 1,
            max: 365
        },
        nextDueDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'paused', 'cancelled', 'suspended'],
            default: 'active',
        },
        maxAmount: {
            type: Number,
            min: 0,
        },
        authorizationMethod: {
            type: String,
            enum: ['checkbox', 'otp', 'digital_signature'],
            required: true,
        },
        authorizationToken: {
            type: String,
        },
        failureRetryCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxRetryCount: {
            type: Number,
            default: 3,
            min: 1,
            max: 10,
        },
        graceLastNotified: {
            type: Date,
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Auto-Debit Log Schema
const walletAutoDebitLogSchema = new mongoose.Schema<WalletAutoDebitLog>(
    {
        mandateId: {
            type: String,
            ref: "WalletAutoDebitMandate",
            required: true,
        },
        debitDate: {
            type: Date,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['success', 'failed', 'pending', 'retry'],
            required: true,
        },
        retryCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        failureReason: {
            type: String,
            maxlength: 500,
        },
        transactionId: {
            type: String,
        },
        systemTriggered: {
            type: Boolean,
            default: true,
        },
        triggeredBy: {
            type: String,
            ref: "User",
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes for better performance
walletAutoDebitMandateSchema.index({ userId: 1 });
walletAutoDebitMandateSchema.index({ serviceId: 1 });
walletAutoDebitMandateSchema.index({ status: 1 });
walletAutoDebitMandateSchema.index({ nextDueDate: 1 });
walletAutoDebitMandateSchema.index({ status: 1, nextDueDate: 1 });

walletAutoDebitLogSchema.index({ mandateId: 1 });
walletAutoDebitLogSchema.index({ debitDate: -1 });
walletAutoDebitLogSchema.index({ status: 1 });
walletAutoDebitLogSchema.index({ createdAt: -1 });

// Virtual for formatted amount
walletAutoDebitMandateSchema.virtual('formattedAmount').get(function() {
    return `₹${(this as any).amount.toFixed(2)}`;
});

// Virtual for formatted next due date
walletAutoDebitMandateSchema.virtual('formattedNextDueDate').get(function() {
    return (this as any).nextDueDate.toLocaleDateString('en-IN');
});

// Method to check if mandate can be debited
walletAutoDebitMandateSchema.methods.canDebit = function() {
    const mandate = this as any;
    return mandate.status === 'active' && 
           new Date() >= mandate.nextDueDate && 
           mandate.failureRetryCount < mandate.maxRetryCount;
};

// Method to calculate next due date based on frequency
walletAutoDebitMandateSchema.methods.calculateNextDueDate = function() {
    const mandate = this as any;
    const currentDue = new Date(mandate.nextDueDate);
    
    switch (mandate.frequency) {
        case 'daily':
            currentDue.setDate(currentDue.getDate() + 1);
            break;
        case 'weekly':
            currentDue.setDate(currentDue.getDate() + 7);
            break;
        case 'monthly':
            currentDue.setMonth(currentDue.getMonth() + 1);
            break;
        case 'quarterly':
            currentDue.setMonth(currentDue.getMonth() + 3);
            break;
        case 'yearly':
            currentDue.setFullYear(currentDue.getFullYear() + 1);
            break;
        case 'custom':
            if (mandate.customFrequencyDays) {
                currentDue.setDate(currentDue.getDate() + mandate.customFrequencyDays);
            }
            break;
    }
    
    return currentDue;
};

// Method to increment retry count
walletAutoDebitMandateSchema.methods.incrementRetryCount = function() {
    const mandate = this as any;
    mandate.failureRetryCount += 1;
    if (mandate.failureRetryCount >= mandate.maxRetryCount) {
        mandate.status = 'suspended';
    }
};

// Method to reset retry count
walletAutoDebitMandateSchema.methods.resetRetryCount = function() {
    const mandate = this as any;
    mandate.failureRetryCount = 0;
};

// Method to pause mandate
walletAutoDebitMandateSchema.methods.pause = function() {
    const mandate = this as any;
    if (mandate.status === 'active') {
        mandate.status = 'paused';
    }
};

// Method to resume mandate
walletAutoDebitMandateSchema.methods.resume = function() {
    const mandate = this as any;
    if (mandate.status === 'paused') {
        mandate.status = 'active';
        mandate.failureRetryCount = 0;
    }
};

// Method to cancel mandate
walletAutoDebitMandateSchema.methods.cancel = function() {
    const mandate = this as any;
    mandate.status = 'cancelled';
};

// Method to suspend mandate
walletAutoDebitMandateSchema.methods.suspend = function() {
    const mandate = this as any;
    mandate.status = 'suspended';
};

// Pre-save middleware to validate custom frequency
walletAutoDebitMandateSchema.pre('save', function(next) {
    const mandate = this as any;
    if (mandate.frequency === 'custom' && !mandate.customFrequencyDays) {
        return next(new Error('Custom frequency days is required when frequency is custom'));
    }
    
    if (mandate.maxAmount && mandate.amount > mandate.maxAmount) {
        return next(new Error('Amount cannot exceed maximum amount'));
    }
    
    next();
});

export const WalletAutoDebitMandateModel = mongoose.model<WalletAutoDebitMandate>(
    "WalletAutoDebitMandate", 
    walletAutoDebitMandateSchema
);

export const WalletAutoDebitLogModel = mongoose.model<WalletAutoDebitLog>(
    "WalletAutoDebitLog", 
    walletAutoDebitLogSchema
);
