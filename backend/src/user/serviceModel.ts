import mongoose from "mongoose";
import type { Service } from "./walletTypes.js";

const serviceSchema = new mongoose.Schema<Service>(
    {
        name: {
            type: String,
            required: true,
            enum: ['Seat Booking', 'Meeting Room', 'Café', 'Printing', 'Parking', 'Event', 'Other'],
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        vendorId: {
            type: String,
            ref: "User",
            required: false,
        },
        description: {
            type: String,
            maxlength: 500,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for better performance
serviceSchema.index({ name: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ vendorId: 1 });

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function() {
    return `₹${this.price.toFixed(2)}`;
});

export const ServiceModel = mongoose.model<Service>("Service", serviceSchema);
