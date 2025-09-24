import { z } from "zod";
import mongoose from "mongoose";

// Custom validators
const objectIdValidator = z.string().refine(
    (val) => mongoose.Types.ObjectId.isValid(val),
    { message: "Invalid ObjectId format" }
);

const dateValidator = z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
);

// Base schemas for sub-documents
export const paymentDetailsSchema = z.object({
    paymentMethod: z.enum(["wallet", "card", "upi", "netbanking", "cash"]),
    walletId: objectIdValidator.optional(),
    transactionReference: z.string().min(1, "Transaction reference is required"),
    paymentGatewayResponse: z.any().optional(),
    paymentStatus: z.enum(["pending", "success", "failed", "refunded", "partially_refunded"]).default("pending"),
    amountPaid: z.number().min(0, "Amount paid must be non-negative"),
    currency: z.string().default("INR"),
    paymentDate: dateValidator.optional(),
    refundTransactionReference: z.string().optional(),
    refundDate: dateValidator.optional()
});

export const overtimeDetailsSchema = z.object({
    actualCheckoutTime: dateValidator,
    overtimeHours: z.number().min(0, "Overtime hours must be non-negative"),
    overtimeAmount: z.number().min(0, "Overtime amount must be non-negative"),
    overtimePaymentStatus: z.enum(["pending", "success", "failed"]).default("pending"),
    overtimeTransactionReference: z.string().optional(),
    isWithinGracePeriod: z.boolean().default(false),
    overtimePaymentDate: dateValidator.optional()
});

export const ratingsSchema = z.object({
    cleanliness: z.number().min(1).max(5).optional(),
    amenities: z.number().min(1).max(5).optional(),
    location: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
    overall: z.number().min(1).max(5).optional(),
    reviewText: z.string().max(1000).optional(),
    reviewDate: dateValidator.optional()
});

// Create booking schema
export const createBookingSchema = z.object({
    propertyId: objectIdValidator,
    checkInTime: dateValidator,
    checkOutTime: dateValidator,
    numberOfSeats: z.number().min(1, "Number of seats must be at least 1"),
    bookingType: z.enum(["hourly", "daily", "weekly", "monthly"]),
    guestCount: z.number().min(1, "Guest count must be at least 1").default(1),
    specialRequests: z.string().max(500).optional(),
    paymentDetails: paymentDetailsSchema
}).refine(
    (data) => {
        const checkIn = new Date(data.checkInTime);
        const checkOut = new Date(data.checkOutTime);
        return checkOut > checkIn;
    },
    {
        message: "Check-out time must be after check-in time",
        path: ["checkOutTime"]
    }
).refine(
    (data) => {
        const checkIn = new Date(data.checkInTime);
        const now = new Date();
        return checkIn > now;
    },
    {
        message: "Check-in time must be in the future",
        path: ["checkInTime"]
    }
);

// Update booking schema (for modifications before check-in)
export const updateBookingSchema = z.object({
    checkInTime: dateValidator.optional(),
    checkOutTime: dateValidator.optional(),
    numberOfSeats: z.number().min(1).optional(),
    guestCount: z.number().min(1).optional(),
    specialRequests: z.string().max(500).optional()
}).refine(
    (data) => {
        if (data.checkInTime && data.checkOutTime) {
            const checkIn = new Date(data.checkInTime);
            const checkOut = new Date(data.checkOutTime);
            return checkOut > checkIn;
        }
        return true;
    },
    {
        message: "Check-out time must be after check-in time",
        path: ["checkOutTime"]
    }
);

// Booking status update schema
export const bookingStatusSchema = z.object({
    bookingStatus: z.enum([
        "pending_payment",
        "confirmed", 
        "checked_in",
        "checked_out",
        "completed",
        "cancelled",
        "no_show",
        "extended"
    ]),
    adminNotes: z.string().max(1000).optional()
});

// Check-in schema
export const checkInSchema = z.object({
    actualCheckInTime: dateValidator.optional()
});

// Check-out schema
export const checkOutSchema = z.object({
    actualCheckOutTime: dateValidator.optional()
});

// Cancel booking schema
export const cancelBookingSchema = z.object({
    cancellationReason: z.string().min(1, "Cancellation reason is required").max(500),
    refundAmount: z.number().min(0).optional()
});

// Rating and review schema
export const addRatingSchema = z.object({
    cleanliness: z.number().min(1).max(5).optional(),
    amenities: z.number().min(1).max(5).optional(),
    location: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
    overall: z.number().min(1).max(5),
    reviewText: z.string().max(1000).optional()
}).refine(
    (data) => {
        // At least overall rating is required
        return data.overall !== undefined;
    },
    {
        message: "Overall rating is required",
        path: ["overall"]
    }
);

// Search and filter schemas
export const bookingSearchSchema = z.object({
    propertyId: objectIdValidator.optional(),
    userId: objectIdValidator.optional(),
    propertyOwnerId: objectIdValidator.optional(),
    bookingStatus: z.enum([
        "pending_payment",
        "confirmed",
        "checked_in", 
        "checked_out",
        "completed",
        "cancelled",
        "no_show",
        "extended"
    ]).optional(),
    bookingType: z.enum(["hourly", "daily", "weekly", "monthly"]).optional(),
    paymentMethod: z.enum(["wallet", "card", "upi", "netbanking", "cash"]).optional(),
    paymentStatus: z.enum(["pending", "success", "failed", "refunded", "partially_refunded"]).optional(),
    checkInDateFrom: dateValidator.optional(),
    checkInDateTo: dateValidator.optional(),
    bookingDateFrom: dateValidator.optional(),
    bookingDateTo: dateValidator.optional(),
    minAmount: z.number().min(0).optional(),
    maxAmount: z.number().min(0).optional(),
    isExtended: z.boolean().optional(),
    hasRatings: z.boolean().optional(),
    searchTerm: z.string().optional(), // For searching booking IDs or transaction references
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10),
    sortBy: z.enum([
        "bookingDate",
        "checkInTime", 
        "checkOutTime",
        "totalAmount",
        "createdAt",
        "lastUpdated"
    ]).default("bookingDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
}).refine(
    (data) => {
        if (data.checkInDateFrom && data.checkInDateTo) {
            const from = new Date(data.checkInDateFrom);
            const to = new Date(data.checkInDateTo);
            return to >= from;
        }
        return true;
    },
    {
        message: "Check-in date 'to' must be after or equal to 'from'",
        path: ["checkInDateTo"]
    }
).refine(
    (data) => {
        if (data.bookingDateFrom && data.bookingDateTo) {
            const from = new Date(data.bookingDateFrom);
            const to = new Date(data.bookingDateTo);
            return to >= from;
        }
        return true;
    },
    {
        message: "Booking date 'to' must be after or equal to 'from'",
        path: ["bookingDateTo"]
    }
).refine(
    (data) => {
        if (data.minAmount && data.maxAmount) {
            return data.maxAmount >= data.minAmount;
        }
        return true;
    },
    {
        message: "Maximum amount must be greater than or equal to minimum amount",
        path: ["maxAmount"]
    }
);

// Pagination schema
export const paginationSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10)
});

// ObjectId param schema
export const objectIdParamSchema = z.object({
    id: objectIdValidator
});

// Property ID param schema
export const propertyIdParamSchema = z.object({
    propertyId: objectIdValidator
});

// Booking ID param schema
export const bookingIdParamSchema = z.object({
    bookingId: z.string().min(1, "Booking ID is required")
});

// Date range schema
export const dateRangeSchema = z.object({
    startDate: dateValidator,
    endDate: dateValidator
}).refine(
    (data) => {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
    },
    {
        message: "End date must be after or equal to start date",
        path: ["endDate"]
    }
);

// Property availability check schema
export const availabilityCheckSchema = z.object({
    propertyId: objectIdValidator,
    checkInTime: dateValidator,
    checkOutTime: dateValidator,
    numberOfSeats: z.number().min(1),
    excludeBookingId: objectIdValidator.optional()
}).refine(
    (data) => {
        const checkIn = new Date(data.checkInTime);
        const checkOut = new Date(data.checkOutTime);
        return checkOut > checkIn;
    },
    {
        message: "Check-out time must be after check-in time",
        path: ["checkOutTime"]
    }
);

// Overtime payment schema
export const overtimePaymentSchema = z.object({
    paymentMethod: z.enum(["wallet", "card", "upi", "netbanking"]),
    walletId: objectIdValidator.optional(),
    transactionReference: z.string().min(1)
});

// Bulk operations schema
export const bulkUpdateBookingStatusSchema = z.object({
    bookingIds: z.array(objectIdValidator).min(1, "At least one booking ID is required"),
    bookingStatus: z.enum([
        "pending_payment",
        "confirmed",
        "checked_in",
        "checked_out", 
        "completed",
        "cancelled",
        "no_show",
        "extended"
    ]),
    adminNotes: z.string().max(1000).optional()
});

// Analytics date range schema
export const analyticsDateRangeSchema = z.object({
    startDate: dateValidator,
    endDate: dateValidator,
    groupBy: z.enum(["day", "week", "month"]).default("day")
}).refine(
    (data) => {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        return diffInDays <= 365; // Max 1 year range
    },
    {
        message: "Date range cannot exceed 365 days",
        path: ["endDate"]
    }
);

// Export type definitions for TypeScript
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type BookingStatusInput = z.infer<typeof bookingStatusSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type AddRatingInput = z.infer<typeof addRatingSchema>;
export type BookingSearchInput = z.infer<typeof bookingSearchSchema>;
export type AvailabilityCheckInput = z.infer<typeof availabilityCheckSchema>;
export type OvertimePaymentInput = z.infer<typeof overtimePaymentSchema>;
export type BulkUpdateBookingStatusInput = z.infer<typeof bulkUpdateBookingStatusSchema>;
export type AnalyticsDateRangeInput = z.infer<typeof analyticsDateRangeSchema>;