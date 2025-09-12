import mongoose, { Document, Model } from "mongoose";
import { v4 as uuidv4 } from "uuid";

// TypeScript interfaces
interface IPaymentDetails {
    paymentMethod: "wallet" | "card" | "upi" | "netbanking" | "cash";
    walletId?: mongoose.Types.ObjectId;
    transactionId: string;
    paymentGatewayResponse?: any;
    paymentStatus: "pending" | "completed" | "failed" | "refunded" | "partially_refunded";
    amountPaid: number;
    currency: string;
    paymentDate?: Date;
    refundTransactionId?: string;
    refundDate?: Date;
}

interface IOvertimeDetails {
    actualCheckoutTime: Date;
    overtimeHours: number;
    overtimeAmount: number;
    overtimePaymentStatus: "pending" | "completed" | "failed";
    overtimeTransactionId?: string;
    isWithinGracePeriod: boolean;
    overtimePaymentDate?: Date;
}

interface IRatings {
    cleanliness?: number;
    amenities?: number;
    location?: number;
    value?: number;
    overall?: number;
    reviewText?: string;
    reviewDate?: Date;
}

interface IBooking extends Document {
    bookingId: string;
    propertyId: mongoose.Types.ObjectId;
    propertyOwnerId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    bookingDate: Date;
    checkInTime: Date;
    checkOutTime: Date;
    actualCheckInTime?: Date;
    actualCheckOutTime?: Date;
    numberOfSeats: number;
    bookingType: "hourly" | "daily" | "weekly" | "monthly";
    totalHours: number;
    baseAmount: number;
    cleaningFee: number;
    taxes: number;
    discountAmount: number;
    totalAmount: number;
    paymentDetails: IPaymentDetails;
    bookingStatus: "pending_payment" | "confirmed" | "checked_in" | "checked_out" | "completed" | "cancelled" | "no_show" | "extended";
    isExtended: boolean;
    overtimeDetails?: IOvertimeDetails;
    guestCount: number;
    specialRequests?: string;
    cancellationReason?: string;
    cancellationDate?: Date;
    refundAmount: number;
    ratings?: IRatings;
    bookingTimestamp: Date;
    lastUpdated: Date;
    adminNotes?: string;

    // Method signatures
    calculateOvertimeCharges(): Promise<{ overtimeAmount: number; overtimeHours: number; isWithinGracePeriod: boolean }>;
    processOvertimePayment(): Promise<number>;
    processCheckout(actualCheckoutTime?: Date): Promise<{ overtimeAmount: number; newStatus: string }>;
    cancelBooking(reason: string, refundAmount?: number): Promise<{ status: string; refundAmount: number }>;
    processCheckIn(actualCheckinTime?: Date): Promise<{ checkedInAt: Date; status: string }>;
    addRatingAndReview(ratingData: Partial<IRatings>): Promise<IRatings>;
    getBookingDuration(): { totalHours: number; totalMinutes: number; totalDays: number };
    isActive(): boolean;
    isModifiable(): boolean;
    canBeCancelled(): boolean;
    getTimeRemaining(): { hours: number; minutes: number };
    calculateRefundAmount(): number;
}

interface IBookingModel extends Model<IBooking> {
    findConflictingBookings(propertyId: mongoose.Types.ObjectId, checkInTime: Date, checkOutTime: Date, excludeBookingId?: mongoose.Types.ObjectId): Promise<IBooking[]>;
    findUserActiveBookings(userId: mongoose.Types.ObjectId): Promise<IBooking[]>;
    findPropertyBookingsInRange(propertyId: mongoose.Types.ObjectId, startDate: Date, endDate: Date): Promise<IBooking[]>;
}

// Sub-schema for payment details
const paymentDetailsSchema = new mongoose.Schema<IPaymentDetails>({
    paymentMethod: {
        type: String,
        enum: ["wallet", "card", "upi", "netbanking", "cash"],
        required: true
    },
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Wallet",
        required: function (this: IPaymentDetails) {
            return this.paymentMethod === "wallet";
        }
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    paymentGatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
        default: "pending"
    },
    amountPaid: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: "INR"
    },
    paymentDate: {
        type: Date
    },
    refundTransactionId: {
        type: String
    },
    refundDate: {
        type: Date
    }
}, { _id: false });

// Sub-schema for overtime details
const overtimeDetailsSchema = new mongoose.Schema<IOvertimeDetails>({
    actualCheckoutTime: {
        type: Date,
        required: true
    },
    overtimeHours: {
        type: Number,
        required: true,
        min: 0
    },
    overtimeAmount: {
        type: Number,
        required: true,
        min: 0
    },
    overtimePaymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending"
    },
    overtimeTransactionId: {
        type: String
    },
    isWithinGracePeriod: {
        type: Boolean,
        default: false
    },
    overtimePaymentDate: {
        type: Date
    }
}, { _id: false });

// Sub-schema for ratings
const ratingsSchema = new mongoose.Schema<IRatings>({
    cleanliness: {
        type: Number,
        min: 1,
        max: 5
    },
    amenities: {
        type: Number,
        min: 1,
        max: 5
    },
    location: {
        type: Number,
        min: 1,
        max: 5
    },
    value: {
        type: Number,
        min: 1,
        max: 5
    },
    overall: {
        type: Number,
        min: 1,
        max: 5
    },
    reviewText: {
        type: String,
        maxlength: 1000
    },
    reviewDate: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const bookingSchema = new mongoose.Schema<IBooking>({
    // Core booking details
    bookingId: {
        type: String,
        required: true,
        unique: true,
        default: function () {
            return `BK${Date.now()}${uuidv4().substring(0, 8)}`;
        }
    },

    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
        index: true
    },

    propertyOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Booking time details
    bookingDate: {
        type: Date,
        required: true,
        index: true
    },

    checkInTime: {
        type: Date,
        required: true,
        index: true
    },

    checkOutTime: {
        type: Date,
        required: true,
        index: true,
        validate: {
            validator: function (this: IBooking, v: Date) {
                return v > this.checkInTime;
            },
            message: "Check-out time must be after check-in time"
        }
    },

    actualCheckInTime: {
        type: Date
    },

    actualCheckOutTime: {
        type: Date
    },

    // Booking details
    numberOfSeats: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: async function (this: IBooking, v: number) {
                const Property = mongoose.model('Property');
                const property = await Property.findById(this.propertyId);
                return property ? v <= property.seatingCapacity : true;
            },
            message: "Number of seats cannot exceed property's seating capacity"
        }
    },

    bookingType: {
        type: String,
        enum: ["hourly", "daily", "weekly", "monthly"],
        required: true
    },

    totalHours: {
        type: Number,
        required: true,
        min: 0.25
    },

    // Pricing details
    baseAmount: {
        type: Number,
        required: true,
        min: 0
    },

    cleaningFee: {
        type: Number,
        default: 0,
        min: 0
    },

    taxes: {
        type: Number,
        default: 0,
        min: 0
    },

    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    // Payment details
    paymentDetails: {
        type: paymentDetailsSchema,
        required: true
    },

    // Booking status
    bookingStatus: {
        type: String,
        enum: [
            "pending_payment",
            "confirmed",
            "checked_in",
            "checked_out",
            "completed",
            "cancelled",
            "no_show",
            "extended"
        ],
        default: "pending_payment",
        index: true
    },

    // Overtime handling
    isExtended: {
        type: Boolean,
        default: false
    },

    overtimeDetails: {
        type: overtimeDetailsSchema
    },

    // Additional details
    guestCount: {
        type: Number,
        default: 1,
        min: 1
    },

    specialRequests: {
        type: String,
        maxlength: 500
    },

    cancellationReason: {
        type: String,
        maxlength: 500
    },

    cancellationDate: {
        type: Date
    },

    refundAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    ratings: {
        type: ratingsSchema
    },

    // System fields
    bookingTimestamp: {
        type: Date,
        default: Date.now,
        required: true
    },

    lastUpdated: {
        type: Date,
        default: Date.now
    },

    adminNotes: {
        type: String,
        maxlength: 1000
    }

}, {
    timestamps: true
});

// Indexes for better performance
bookingSchema.index({ propertyId: 1, checkInTime: 1, checkOutTime: 1 });
bookingSchema.index({ userId: 1, bookingDate: -1 });
bookingSchema.index({ propertyOwnerId: 1, bookingDate: -1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ bookingDate: 1, checkInTime: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ checkInTime: 1, checkOutTime: 1 });

// Pre-save middleware for booking validation with 30-minute mandatory gap
bookingSchema.pre('save', async function (next) {
    try {
        // Update lastUpdated timestamp
        this.lastUpdated = new Date();

        // Validate booking doesn't conflict with existing bookings
        if (this.isNew || this.isModified('checkInTime') || this.isModified('checkOutTime')) {
            // Check for direct conflicts (overlapping times)
            const conflictingBooking = await this.constructor.findOne({
                propertyId: this.propertyId,
                bookingStatus: { $in: ['confirmed', 'checked_in', 'extended'] },
                _id: { $ne: this._id },
                $or: [
                    {
                        checkInTime: { $lt: this.checkOutTime },
                        checkOutTime: { $gt: this.checkInTime }
                    }
                ]
            });

            if (conflictingBooking) {
                return next(new Error('Booking conflicts with existing reservation'));
            }

            // Check 30-minute MANDATORY buffer between different users' bookings
            const bufferTimeMs = 30 * 60 * 1000; // 30 minutes in milliseconds

            const bufferBookings = await this.constructor.find({
                propertyId: this.propertyId,
                userId: { $ne: this.userId },
                bookingStatus: { $in: ['confirmed', 'checked_in', 'completed', 'checked_out', 'extended'] },
                _id: { $ne: this._id },
                $or: [
                    {
                        // Check if any booking ends within 30 minutes before this booking starts
                        checkOutTime: {
                            $gt: new Date(this.checkInTime.getTime() - bufferTimeMs),
                            $lte: this.checkInTime
                        }
                    },
                    {
                        // Check if any booking starts within 30 minutes after this booking ends
                        checkInTime: {
                            $gte: this.checkOutTime,
                            $lt: new Date(this.checkOutTime.getTime() + bufferTimeMs)
                        }
                    }
                ]
            });

            if (bufferBookings.length > 0) {
                return next(new Error('Minimum 30-minute gap required between bookings by different users'));
            }

            // Validate against property availability
            const Property = mongoose.model('Property');
            const property = await Property.findById(this.propertyId);
            if (property) {
                const bookingDate = this.checkInTime.toISOString().split('T')[0];
                const startTime = this.checkInTime.toTimeString().substring(0, 5);
                const endTime = this.checkOutTime.toTimeString().substring(0, 5);

                if (!property.isAvailableForBooking(bookingDate, startTime, endTime)) {
                    return next(new Error('Property is not available for the selected time slot'));
                }
            }
        }

        // Validate total amount calculation
        const expectedTotal = this.baseAmount + this.cleaningFee + this.taxes - this.discountAmount;
        if (Math.abs(this.totalAmount - expectedTotal) > 0.01) {
            return next(new Error('Total amount calculation is incorrect'));
        }

        // Validate payment amount matches total amount for completed payments
        if (this.paymentDetails.paymentStatus === 'completed' &&
            Math.abs(this.paymentDetails.amountPaid - this.totalAmount) > 0.01) {
            return next(new Error('Payment amount must match total booking amount'));
        }

        next();
    } catch (error) {
        next(error as Error);
    }
});

// Static methods
bookingSchema.statics.findConflictingBookings = function (
    propertyId: mongoose.Types.ObjectId,
    checkInTime: Date,
    checkOutTime: Date,
    excludeBookingId?: mongoose.Types.ObjectId
) {
    const query: any = {
        propertyId: propertyId,
        bookingStatus: { $in: ['confirmed', 'checked_in', 'extended'] },
        $or: [
            {
                checkInTime: { $lt: checkOutTime },
                checkOutTime: { $gt: checkInTime }
            }
        ]
    };

    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    return this.find(query);
};

bookingSchema.statics.findUserActiveBookings = function (userId: mongoose.Types.ObjectId) {
    return this.find({
        userId: userId,
        bookingStatus: { $in: ['confirmed', 'checked_in', 'extended'] }
    }).sort({ checkInTime: 1 });
};

bookingSchema.statics.findPropertyBookingsInRange = function (
    propertyId: mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
) {
    return this.find({
        propertyId: propertyId,
        bookingStatus: { $ne: 'cancelled' },
        checkInTime: { $gte: startDate },
        checkOutTime: { $lte: endDate }
    }).sort({ checkInTime: 1 });
};

// Instance methods
bookingSchema.methods.calculateOvertimeCharges = async function (this: IBooking) {
    if (!this.actualCheckOutTime || this.actualCheckOutTime <= this.checkOutTime) {
        return {
            overtimeAmount: 0,
            overtimeHours: 0,
            isWithinGracePeriod: true
        };
    }

    const Property = mongoose.model('Property');
    const property = await Property.findById(this.propertyId);
    if (!property) {
        throw new Error('Property not found');
    }

    const gracePeriodMs = property.bookingRules.checkoutGracePeriod * 60 * 1000;
    const effectiveOvertimeStart = new Date(this.checkOutTime.getTime() + gracePeriodMs);

    if (this.actualCheckOutTime <= effectiveOvertimeStart) {
        return {
            overtimeAmount: 0,
            overtimeHours: 0,
            isWithinGracePeriod: true
        };
    }

    const overtimeMs = this.actualCheckOutTime.getTime() - effectiveOvertimeStart.getTime();
    const overtimeHours = Math.ceil(overtimeMs / (60 * 60 * 1000));

    const overtimeRate = property.pricing.overtimeHourlyRate || (property.pricing.hourlyRate || 0) * 1.5;
    const overtimeAmount = overtimeHours * overtimeRate * this.numberOfSeats;

    return {
        overtimeAmount,
        overtimeHours,
        isWithinGracePeriod: false
    };
};

bookingSchema.methods.processOvertimePayment = async function (this: IBooking) {
    const overtimeInfo = await this.calculateOvertimeCharges();

    if (overtimeInfo.overtimeAmount > 0) {
        this.isExtended = true;
        this.overtimeDetails = {
            actualCheckoutTime: this.actualCheckOutTime!,
            overtimeHours: overtimeInfo.overtimeHours,
            overtimeAmount: overtimeInfo.overtimeAmount,
            overtimePaymentStatus: 'pending',
            isWithinGracePeriod: overtimeInfo.isWithinGracePeriod
        };

        // Update booking status to extended
        this.bookingStatus = 'extended';

        await this.save();
        return overtimeInfo.overtimeAmount;
    }

    return 0;
};

bookingSchema.methods.processCheckout = async function (this: IBooking, actualCheckoutTime?: Date) {
    this.actualCheckOutTime = actualCheckoutTime || new Date();
    this.bookingStatus = 'checked_out';

    // Calculate and handle overtime if any
    const overtimeAmount = await this.processOvertimePayment();

    // If no overtime, mark as completed
    if (overtimeAmount === 0) {
        this.bookingStatus = 'completed';
    }

    await this.save();

    return {
        overtimeAmount,
        newStatus: this.bookingStatus
    };
};

bookingSchema.methods.cancelBooking = async function (this: IBooking, reason: string, refundAmount: number = 0) {
    this.bookingStatus = 'cancelled';
    this.cancellationReason = reason;
    this.cancellationDate = new Date();
    this.refundAmount = refundAmount;

    // Update payment status if refund is processed
    if (refundAmount > 0) {
        this.paymentDetails.paymentStatus = refundAmount >= this.totalAmount ? 'refunded' : 'partially_refunded';
        this.paymentDetails.refundDate = new Date();
    }

    await this.save();

    return {
        status: 'cancelled',
        refundAmount: this.refundAmount
    };
};

bookingSchema.methods.processCheckIn = async function (this: IBooking, actualCheckinTime?: Date) {
    this.actualCheckInTime = actualCheckinTime || new Date();
    this.bookingStatus = 'checked_in';

    await this.save();

    return {
        checkedInAt: this.actualCheckInTime,
        status: this.bookingStatus
    };
};

bookingSchema.methods.addRatingAndReview = async function (this: IBooking, ratingData: Partial<IRatings>) {
    this.ratings = {
        cleanliness: ratingData.cleanliness || 0,
        amenities: ratingData.amenities || 0,
        location: ratingData.location || 0,
        value: ratingData.value || 0,
        overall: ratingData.overall || 0,
        reviewText: ratingData.reviewText,
        reviewDate: new Date()
    };

    await this.save();

    return this.ratings;
};

bookingSchema.methods.getBookingDuration = function (this: IBooking) {
    const durationMs = this.checkOutTime.getTime() - this.checkInTime.getTime();
    const durationHours = durationMs / (60 * 60 * 1000);

    return {
        totalHours: durationHours,
        totalMinutes: durationMs / (60 * 1000),
        totalDays: Math.ceil(durationHours / 24)
    };
};

bookingSchema.methods.isActive = function (this: IBooking) {
    return ['confirmed', 'checked_in', 'extended'].includes(this.bookingStatus);
};

bookingSchema.methods.isModifiable = function (this: IBooking) {
    return ['pending_payment', 'confirmed'].includes(this.bookingStatus);
};

bookingSchema.methods.canBeCancelled = function (this: IBooking) {
    return ['pending_payment', 'confirmed'].includes(this.bookingStatus);
};

bookingSchema.methods.getTimeRemaining = function (this: IBooking) {
    const now = new Date();
    const timeRemaining = this.checkInTime.getTime() - now.getTime();

    if (timeRemaining <= 0) {
        return { hours: 0, minutes: 0 };
    }

    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

    return { hours, minutes };
};

bookingSchema.methods.calculateRefundAmount = function (this: IBooking) {
    const now = new Date();
    const hoursUntilCheckIn = (this.checkInTime.getTime() - now.getTime()) / (60 * 60 * 1000);

    // Updated Cancellation policy
    if (hoursUntilCheckIn >= 24) {
        return this.totalAmount * 0.8; // 80% refund if cancelled 24+ hours before
    } else if (hoursUntilCheckIn >= 12) {
        return this.totalAmount * 0.5; // 50% refund if cancelled 12–24 hours before
    } else if (hoursUntilCheckIn >= 4) {
        return this.totalAmount * 0.25; // 25% refund if cancelled 4–12 hours before
    } else {
        return 0; // No refund if cancelled less than 4 hours before
    }
};

// Add compound indexes for complex queries
bookingSchema.index({
    propertyId: 1,
    checkInTime: 1,
    checkOutTime: 1,
    bookingStatus: 1
});

bookingSchema.index({
    userId: 1,
    bookingStatus: 1,
    checkInTime: -1
});

bookingSchema.index({
    propertyOwnerId: 1,
    bookingDate: -1,
    bookingStatus: 1
});

// Text index for search functionality
bookingSchema.index({
    bookingId: "text",
    "paymentDetails.transactionId": "text"
});

export const Booking = mongoose.model<IBooking, IBookingModel>("Booking", bookingSchema);