import mongoose from "mongoose";
import type { WalletCashbackRule } from "./walletTypes.js";

const walletCashbackRuleSchema = new mongoose.Schema<WalletCashbackRule>(
    {
        minAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        cashbackAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        cashbackType: {
            type: String,
            enum: ['fixed', 'percentage'],
            required: true,
            default: 'fixed',
        },
        maxCashback: {
            type: Number,
            min: 0,
            required: function() {
                return this.cashbackType === 'percentage';
            },
        },
        serviceType: {
            type: String,
            enum: ['Seat Booking', 'Meeting Room', 'Café', 'Printing', 'Parking', 'Event', 'All'],
            default: 'All',
        },
        validFrom: {
            type: Date,
            required: true,
            default: Date.now,
        },
        validTo: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
        description: {
            type: String,
            required: true,
            maxlength: 200,
            trim: true,
        },
        usageLimit: {
            type: Number,
            min: 1,
            default: null, // null means unlimited
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for better performance
walletCashbackRuleSchema.index({ status: 1, validFrom: 1, validTo: 1 });
walletCashbackRuleSchema.index({ serviceType: 1 });
walletCashbackRuleSchema.index({ minAmount: 1 });

// Virtual for rule summary
walletCashbackRuleSchema.virtual('ruleSummary').get(function() {
    if (this.cashbackType === 'percentage') {
        return `${this.cashbackAmount}% cashback (max ₹${this.maxCashback}) on orders above ₹${this.minAmount}`;
    }
    return `₹${this.cashbackAmount} cashback on orders above ₹${this.minAmount}`;
});

// Method to check if rule is currently valid
walletCashbackRuleSchema.methods.isValid = function() {
    const now = new Date();
    return this.status === 'active' && 
           this.validFrom <= now && 
           this.validTo >= now;
};

// Method to calculate cashback amount
walletCashbackRuleSchema.methods.calculateCashback = function(amount: number) {
    if (amount < this.minAmount) {
        return 0;
    }
    
    if (this.cashbackType === 'percentage') {
        const cashback = (amount * this.cashbackAmount) / 100;
        return this.maxCashback ? Math.min(cashback, this.maxCashback) : cashback;
    }
    
    return this.cashbackAmount;
};

// Static method to get applicable rules for amount and service
walletCashbackRuleSchema.statics.getApplicableRules = async function(amount: number, serviceType?: string) {
    const now = new Date();
    const query: any = {
        status: 'active',
        validFrom: { $lte: now },
        validTo: { $gte: now },
        minAmount: { $lte: amount }
    };
    
    if (serviceType) {
        query.$or = [
            { serviceType: serviceType },
            { serviceType: 'All' }
        ];
    }
    
    return await this.find(query).sort({ cashbackAmount: -1 });
};

// Define interface for the model with static methods
interface WalletCashbackRuleModelInterface extends mongoose.Model<WalletCashbackRule> {
    getApplicableRules(amount: number, serviceType?: string): Promise<WalletCashbackRule[]>;
}

export const WalletCashbackRuleModel = mongoose.model<WalletCashbackRule>("WalletCashbackRule", walletCashbackRuleSchema) as WalletCashbackRuleModelInterface;
