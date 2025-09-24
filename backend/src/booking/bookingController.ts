import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { ZodError } from "zod";
import type { AuthRequest } from "../middleware/authMiddleware.js";

// Extended AuthRequest interface for booking operations
interface BookingAuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        email: string;
    };
}
import { Booking } from "./bookingModel.js";
import { Property } from "../property/propertyModel.js";
import { User } from "../user/userModel.js";
import { WalletModel } from "../wallet/walletModel.js";
import mongoose from "mongoose";
import {
    createBookingSchema,
    updateBookingSchema,
    bookingSearchSchema,
    objectIdParamSchema,
    propertyIdParamSchema,
    bookingIdParamSchema,
    availabilityCheckSchema,
    dateRangeSchema,
    analyticsDateRangeSchema,
    checkInSchema,
    checkOutSchema,
    cancelBookingSchema,
    addRatingSchema,
    bookingStatusSchema,
    overtimePaymentSchema,
    type CreateBookingInput,
    type UpdateBookingInput,
    type BookingSearchInput,
    type AvailabilityCheckInput,
    type AnalyticsDateRangeInput,
    type CheckInInput,
    type CheckOutInput,
    type CancelBookingInput,
    type AddRatingInput,
    type BookingStatusInput,
    type OvertimePaymentInput
} from "./bookingZodSchema.js";

// Helper function to calculate booking totals
const calculateBookingTotals = async (
    propertyId: string,
    checkInTime: Date,
    checkOutTime: Date,
    numberOfSeats: number,
    bookingType: string
) => {
    const property = await Property.findById(propertyId);
    if (!property) {
        throw createHttpError(404, "Property not found");
    }

    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    const durationHours = durationMs / (60 * 60 * 1000);

    let baseAmount = 0;
    
    // Calculate base amount based on booking type and property pricing
    switch (bookingType) {
        case "hourly":
            baseAmount = (property.pricing.hourlyRate || 0) * durationHours;
            break;
        case "daily":
            const days = Math.ceil(durationHours / 24);
            baseAmount = (property.pricing.dailyRate || (property.pricing.hourlyRate || 0) * 24) * days;
            break;
        case "weekly":
            const weeks = Math.ceil(durationHours / (24 * 7));
            baseAmount = (property.pricing.weeklyRate || (property.pricing.dailyRate || (property.pricing.hourlyRate || 0) * 24) * 7) * weeks;
            break;
        case "monthly":
            const months = Math.ceil(durationHours / (24 * 30));
            baseAmount = (property.pricing.monthlyRate || (property.pricing.weeklyRate || (property.pricing.dailyRate || (property.pricing.hourlyRate || 0) * 24) * 7) * 4) * months;
            break;
    }

    baseAmount *= numberOfSeats;

    const cleaningFee = property.pricing.cleaningFee || 0;
    const taxRate = 0.18; // 18% GST
    const taxes = (baseAmount + cleaningFee) * taxRate;
    const totalAmount = baseAmount + cleaningFee + taxes;

    return {
        baseAmount,
        cleaningFee,
        taxes,
        totalAmount,
        totalHours: durationHours
    };
};

// Create a new booking
export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        // Validate request body
        const validatedData = createBookingSchema.parse(req.body);

        // Check if property exists and is available
        const property = await Property.findById(validatedData.propertyId);
        if (!property) {
            return next(createHttpError(404, "Property not found"));
        }

        if (property.propertyStatus !== "active") {
            return next(createHttpError(400, "Property is not available for booking"));
        }

        const checkInTime = new Date(validatedData.checkInTime);
        const checkOutTime = new Date(validatedData.checkOutTime);

        // Check for conflicting bookings
        const conflictingBookings = await Booking.findConflictingBookings(
            new mongoose.Types.ObjectId(validatedData.propertyId),
            checkInTime,
            checkOutTime
        );

        if (conflictingBookings.length > 0) {
            return next(createHttpError(409, "Property is already booked for the selected time slot"));
        }

        // Validate property availability for the time slot
        const bookingDate = checkInTime.toISOString().split('T')[0]!;
        const startTime = checkInTime.toTimeString().substring(0, 5);
        const endTime = checkOutTime.toTimeString().substring(0, 5);

        if (!property.isAvailableForBooking(bookingDate, startTime, endTime)) {
            return next(createHttpError(400, "Property is not available for the selected time slot"));
        }

        // Calculate booking totals
        const totals = await calculateBookingTotals(
            validatedData.propertyId,
            checkInTime,
            checkOutTime,
            validatedData.numberOfSeats,
            validatedData.bookingType
        );

        // Validate payment details for wallet payments
        if (validatedData.paymentDetails.paymentMethod === "wallet") {
            if (!validatedData.paymentDetails.walletId) {
                return next(createHttpError(400, "Wallet ID is required for wallet payments"));
            }

            const wallet = await WalletModel.findOne({
                _id: validatedData.paymentDetails.walletId,
                userId: userId
            });

            if (!wallet) {
                return next(createHttpError(404, "Wallet not found"));
            }

            if (wallet.balance < totals.totalAmount) {
                return next(createHttpError(400, "Insufficient wallet balance"));
            }
        }

        // Create booking
        const bookingData = {
            ...validatedData,
            userId: new mongoose.Types.ObjectId(userId),
            propertyOwnerId: property.ownerId,
            bookingDate: new Date(),
            checkInTime,
            checkOutTime,
            ...totals,
            discountAmount: 0,
            refundAmount: 0,
            guestCount: validatedData.guestCount || 1,
            bookingStatus: "pending_payment" as const
        };

        const booking = new Booking(bookingData);
        await booking.save();

        // Populate related data for response
        await booking.populate([
            { path: "propertyId", select: "name address images" },
            { path: "userId", select: "name email phoneNumber" },
            { path: "propertyOwnerId", select: "name email phoneNumber" }
        ]);

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: booking
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get booking by ID
export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id).populate([
            { path: "propertyId", select: "name address images" },
            { path: "userId", select: "name email phoneNumber" },
            { path: "propertyOwnerId", select: "name email phoneNumber" }
        ]);

        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization - user can only access their own bookings, property owners can access bookings for their properties, admins can access all
        if (userRole !== "admin" && 
            booking.userId.toString() !== userId && 
            booking.propertyOwnerId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        res.json({
            success: true,
            data: booking
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get booking by booking ID
export const getBookingByBookingId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bookingId } = bookingIdParamSchema.parse(req.params);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findOne({ bookingId }).populate([
            { path: "propertyId", select: "name address images" },
            { path: "userId", select: "name email phoneNumber" },
            { path: "propertyOwnerId", select: "name email phoneNumber" }
        ]);

        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization
        if (userRole !== "admin" && 
            booking.userId.toString() !== userId && 
            booking.propertyOwnerId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        res.json({
            success: true,
            data: booking
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Update booking (before check-in only)
export const updateBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = updateBookingSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization - only the booking user can modify their booking
        if (booking.userId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        // Check if booking can be modified
        if (!booking.isModifiable()) {
            return next(createHttpError(400, "Booking cannot be modified in its current status"));
        }

        // Check modification time limit (e.g., 2 hours before check-in)
        const now = new Date();
        const hoursUntilCheckIn = (booking.checkInTime.getTime() - now.getTime()) / (60 * 60 * 1000);
        if (hoursUntilCheckIn < 2) {
            return next(createHttpError(400, "Bookings cannot be modified within 2 hours of check-in time"));
        }

        // If dates are being changed, recalculate totals and check availability
        if (validatedData.checkInTime || validatedData.checkOutTime) {
            const newCheckInTime = validatedData.checkInTime ? new Date(validatedData.checkInTime) : booking.checkInTime;
            const newCheckOutTime = validatedData.checkOutTime ? new Date(validatedData.checkOutTime) : booking.checkOutTime;

            // Check for conflicts with the new time slot (excluding current booking)
            const conflictingBookings = await Booking.findConflictingBookings(
                booking.propertyId,
                newCheckInTime,
                newCheckOutTime,
                booking._id as mongoose.Types.ObjectId
            );

            if (conflictingBookings.length > 0) {
                return next(createHttpError(409, "Property is already booked for the selected time slot"));
            }

            // Recalculate totals if dates or seats changed
            const numberOfSeats = validatedData.numberOfSeats || booking.numberOfSeats;
            const totals = await calculateBookingTotals(
                booking.propertyId.toString(),
                newCheckInTime,
                newCheckOutTime,
                numberOfSeats,
                booking.bookingType
            );

            Object.assign(booking, validatedData, {
                checkInTime: newCheckInTime,
                checkOutTime: newCheckOutTime,
                ...totals
            });
        } else {
            // Only update non-date fields
            Object.assign(booking, validatedData);
        }

        await booking.save();

        // Populate for response
        await booking.populate([
            { path: "propertyId", select: "name address images" },
            { path: "userId", select: "name email phoneNumber" },
            { path: "propertyOwnerId", select: "name email phoneNumber" }
        ]);

        res.json({
            success: true,
            message: "Booking updated successfully",
            data: booking
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get user's bookings
export const getUserBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const searchParams = bookingSearchSchema.parse(req.query);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        // Build query
        const query: any = { userId: new mongoose.Types.ObjectId(userId) };

        // Apply filters
        if (searchParams.bookingStatus) {
            query.bookingStatus = searchParams.bookingStatus;
        }

        if (searchParams.bookingType) {
            query.bookingType = searchParams.bookingType;
        }

        if (searchParams.checkInDateFrom || searchParams.checkInDateTo) {
            query.checkInTime = {};
            if (searchParams.checkInDateFrom) {
                query.checkInTime.$gte = new Date(searchParams.checkInDateFrom);
            }
            if (searchParams.checkInDateTo) {
                query.checkInTime.$lte = new Date(searchParams.checkInDateTo);
            }
        }

        if (searchParams.minAmount || searchParams.maxAmount) {
            query.totalAmount = {};
            if (searchParams.minAmount) {
                query.totalAmount.$gte = searchParams.minAmount;
            }
            if (searchParams.maxAmount) {
                query.totalAmount.$lte = searchParams.maxAmount;
            }
        }

        if (searchParams.searchTerm) {
            query.$or = [
                { bookingId: { $regex: searchParams.searchTerm, $options: "i" } },
                { "paymentDetails.transactionReference": { $regex: searchParams.searchTerm, $options: "i" } }
            ];
        }

        // Calculate pagination
        const skip = (searchParams.page - 1) * searchParams.limit;

        // Execute query
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate([
                    { path: "propertyId", select: "name address images" },
                    { path: "propertyOwnerId", select: "name email phoneNumber" }
                ])
                .sort({ [searchParams.sortBy]: searchParams.sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(searchParams.limit),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / searchParams.limit);

        res.json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: searchParams.page,
                    totalPages,
                    totalRecords: total,
                    hasNextPage: searchParams.page < totalPages,
                    hasPrevPage: searchParams.page > 1
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get property owner's bookings
export const getPropertyOwnerBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const searchParams = bookingSearchSchema.parse(req.query);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        // Build query for property owner's bookings
        const query: any = { propertyOwnerId: new mongoose.Types.ObjectId(userId) };

        // Apply filters (same as getUserBookings but for property owner)
        if (searchParams.bookingStatus) {
            query.bookingStatus = searchParams.bookingStatus;
        }

        if (searchParams.propertyId) {
            query.propertyId = new mongoose.Types.ObjectId(searchParams.propertyId);
        }

        if (searchParams.bookingType) {
            query.bookingType = searchParams.bookingType;
        }

        if (searchParams.checkInDateFrom || searchParams.checkInDateTo) {
            query.checkInTime = {};
            if (searchParams.checkInDateFrom) {
                query.checkInTime.$gte = new Date(searchParams.checkInDateFrom);
            }
            if (searchParams.checkInDateTo) {
                query.checkInTime.$lte = new Date(searchParams.checkInDateTo);
            }
        }

        if (searchParams.searchTerm) {
            query.$or = [
                { bookingId: { $regex: searchParams.searchTerm, $options: "i" } },
                { "paymentDetails.transactionReference": { $regex: searchParams.searchTerm, $options: "i" } }
            ];
        }

        // Calculate pagination
        const skip = (searchParams.page - 1) * searchParams.limit;

        // Execute query
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate([
                    { path: "propertyId", select: "name address images" },
                    { path: "userId", select: "name email phoneNumber" }
                ])
                .sort({ [searchParams.sortBy]: searchParams.sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(searchParams.limit),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / searchParams.limit);

        res.json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: searchParams.page,
                    totalPages,
                    totalRecords: total,
                    hasNextPage: searchParams.page < totalPages,
                    hasPrevPage: searchParams.page > 1
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Check property availability
export const checkAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validatedData = availabilityCheckSchema.parse(req.query);

        const checkInTime = new Date(validatedData.checkInTime);
        const checkOutTime = new Date(validatedData.checkOutTime);

        // Check if property exists
        const property = await Property.findById(validatedData.propertyId);
        if (!property) {
            return next(createHttpError(404, "Property not found"));
        }

        // Check for conflicting bookings
        const conflictingBookings = await Booking.findConflictingBookings(
            new mongoose.Types.ObjectId(validatedData.propertyId),
            checkInTime,
            checkOutTime,
            validatedData.excludeBookingId ? new mongoose.Types.ObjectId(validatedData.excludeBookingId) : undefined
        );

        const isAvailable = conflictingBookings.length === 0;

        // If available, also check against property's availability settings
        let isPropertyAvailable = true;
        if (isAvailable) {
            const bookingDate = checkInTime.toISOString().split('T')[0]!;
            const startTime = checkInTime.toTimeString().substring(0, 5);
            const endTime = checkOutTime.toTimeString().substring(0, 5);
            isPropertyAvailable = property.isAvailableForBooking(bookingDate, startTime, endTime);
        }

        // Calculate estimated pricing if available
        let pricing = null;
        if (isAvailable && isPropertyAvailable) {
            try {
                const totals = await calculateBookingTotals(
                    validatedData.propertyId,
                    checkInTime,
                    checkOutTime,
                    validatedData.numberOfSeats,
                    "hourly" // Default to hourly for estimation
                );
                pricing = totals;
            } catch (error) {
                console.error("Error calculating pricing:", error);
            }
        }

        res.json({
            success: true,
            data: {
                isAvailable: isAvailable && isPropertyAvailable,
                conflictingBookings: conflictingBookings.length,
                pricing,
                property: {
                    name: property.name,
                    seatingCapacity: property.seatingCapacity
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Delete booking (only pending payments can be deleted)
export const deleteBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization
        if (booking.userId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        // Only allow deletion of pending payment bookings
        if (booking.bookingStatus !== "pending_payment") {
            return next(createHttpError(400, "Only pending payment bookings can be deleted"));
        }

        await Booking.findByIdAndDelete(id);

        res.json({
            success: true,
            message: "Booking deleted successfully"
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get booking analytics for property owners
export const getBookingAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateRange = analyticsDateRangeSchema.parse(req.query);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);

        // Aggregate booking data for the property owner
        const analytics = await Booking.aggregate([
            {
                $match: {
                    propertyOwnerId: new mongoose.Types.ObjectId(userId),
                    bookingDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        status: "$bookingStatus",
                        date: {
                            $dateToString: { 
                                format: dateRange.groupBy === "day" ? "%Y-%m-%d" :
                                       dateRange.groupBy === "week" ? "%Y-%U" : "%Y-%m",
                                date: "$bookingDate"
                            }
                        }
                    },
                    count: { $sum: 1 },
                    totalRevenue: { $sum: "$totalAmount" },
                    avgBookingValue: { $avg: "$totalAmount" }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    bookings: {
                        $push: {
                            status: "$_id.status",
                            count: "$count",
                            totalRevenue: "$totalRevenue",
                            avgBookingValue: "$avgBookingValue"
                        }
                    },
                    totalBookings: { $sum: "$count" },
                    totalRevenue: { $sum: "$totalRevenue" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get overall summary
        const summary = await Booking.aggregate([
            {
                $match: {
                    propertyOwnerId: new mongoose.Types.ObjectId(userId),
                    bookingDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: "$totalAmount" },
                    avgBookingValue: { $avg: "$totalAmount" },
                    statusBreakdown: {
                        $push: {
                            status: "$bookingStatus",
                            count: 1
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                analytics,
                summary: summary[0] || {
                    totalBookings: 0,
                    totalRevenue: 0,
                    avgBookingValue: 0,
                    statusBreakdown: []
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Check-in booking
export const checkInBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = checkInSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization - property owner or booking user can check-in
        if (userRole !== "admin" && 
            booking.userId.toString() !== userId && 
            booking.propertyOwnerId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        // Validate booking status
        if (booking.bookingStatus !== "confirmed") {
            return next(createHttpError(400, "Only confirmed bookings can be checked in"));
        }

        // Check if check-in time is valid (not too early or too late)
        const now = new Date();
        const checkInTime = booking.checkInTime;
        const timeDiffHours = (now.getTime() - checkInTime.getTime()) / (60 * 60 * 1000);

        // Allow check-in 15 minutes before scheduled time
        if (timeDiffHours < -0.25) {
            return next(createHttpError(400, "Check-in is not yet available. Please wait until 15 minutes before your scheduled time."));
        }

        // Consider booking as no-show if trying to check-in more than 2 hours late
        if (timeDiffHours > 2) {
            booking.bookingStatus = "no_show";
            await booking.save();
            return next(createHttpError(400, "Check-in window has passed. Booking marked as no-show."));
        }

        const result = await booking.processCheckIn(
            validatedData.actualCheckInTime ? new Date(validatedData.actualCheckInTime) : undefined
        );

        res.json({
            success: true,
            message: "Check-in completed successfully",
            data: {
                bookingId: booking.bookingId,
                actualCheckInTime: result.checkedInAt,
                status: result.status
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Check-out booking
export const checkOutBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = checkOutSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization
        if (userRole !== "admin" && 
            booking.userId.toString() !== userId && 
            booking.propertyOwnerId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        // Validate booking status
        if (booking.bookingStatus !== "checked_in") {
            return next(createHttpError(400, "Only checked-in bookings can be checked out"));
        }

        const result = await booking.processCheckout(
            validatedData.actualCheckOutTime ? new Date(validatedData.actualCheckOutTime) : undefined
        );

        let responseMessage = "Check-out completed successfully";
        if (result.overtimeAmount > 0) {
            responseMessage += `. Overtime charges of ₹${result.overtimeAmount} apply.`;
        }

        res.json({
            success: true,
            message: responseMessage,
            data: {
                bookingId: booking.bookingId,
                status: result.newStatus,
                overtimeAmount: result.overtimeAmount,
                needsOvertimePayment: result.overtimeAmount > 0
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Cancel booking
export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = cancelBookingSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization - only booking user can cancel (unless admin)
        if (userRole !== "admin" && booking.userId.toString() !== userId) {
            return next(createHttpError(403, "Only the booking user can cancel this booking"));
        }

        // Check if booking can be cancelled
        if (!booking.canBeCancelled()) {
            return next(createHttpError(400, "Booking cannot be cancelled in its current status"));
        }

        // Calculate refund amount if not provided
        const refundAmount = validatedData.refundAmount !== undefined ? 
            validatedData.refundAmount : 
            booking.calculateRefundAmount();

        const result = await booking.cancelBooking(validatedData.cancellationReason, refundAmount);

        // If there's a refund and payment was via wallet, process wallet refund
        if (refundAmount > 0 && booking.isWalletPayment()) {
            try {
                const wallet = await WalletModel.findById(booking.paymentDetails.walletId);
                if (wallet) {
                    // Add refund transaction to wallet
                    await wallet.creditAmount(
                        refundAmount,
                        `Refund for cancelled booking ${booking.bookingId}`,
                        `REFUND_${booking.bookingId}`,
                        "refund"
                    );
                }
            } catch (walletError) {
                console.error("Error processing wallet refund:", walletError);
            }
        }

        res.json({
            success: true,
            message: "Booking cancelled successfully",
            data: {
                bookingId: booking.bookingId,
                status: result.status,
                refundAmount: result.refundAmount,
                cancellationReason: validatedData.cancellationReason
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Add rating and review
export const addBookingRating = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = addRatingSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization - only booking user can add rating
        if (booking.userId.toString() !== userId) {
            return next(createHttpError(403, "Only the booking user can add ratings"));
        }

        // Check if booking is completed
        if (booking.bookingStatus !== "completed") {
            return next(createHttpError(400, "Only completed bookings can be rated"));
        }

        // Check if rating already exists
        if (booking.ratings) {
            return next(createHttpError(400, "Rating already exists for this booking"));
        }

        const ratingsData: any = { overall: validatedData.overall };
        if (validatedData.cleanliness !== undefined) ratingsData.cleanliness = validatedData.cleanliness;
        if (validatedData.amenities !== undefined) ratingsData.amenities = validatedData.amenities;
        if (validatedData.location !== undefined) ratingsData.location = validatedData.location;
        if (validatedData.value !== undefined) ratingsData.value = validatedData.value;
        if (validatedData.reviewText !== undefined) ratingsData.reviewText = validatedData.reviewText;

        const ratings = await booking.addRatingAndReview(ratingsData);

        res.json({
            success: true,
            message: "Rating added successfully",
            data: {
                bookingId: booking.bookingId,
                ratings
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Update booking status (Admin only)
export const updateBookingStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = bookingStatusSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userRole = authReq.user?.role;

        if (userRole !== "admin") {
            return next(createHttpError(403, "Admin access required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        booking.bookingStatus = validatedData.bookingStatus;
        if (validatedData.adminNotes) {
            booking.adminNotes = validatedData.adminNotes;
        }

        await booking.save();

        res.json({
            success: true,
            message: "Booking status updated successfully",
            data: {
                bookingId: booking.bookingId,
                status: booking.bookingStatus,
                adminNotes: booking.adminNotes
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Process overtime payment
export const processOvertimePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = objectIdParamSchema.parse(req.params);
        const validatedData = overtimePaymentSchema.parse(req.body);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return next(createHttpError(404, "Booking not found"));
        }

        // Check authorization
        if (booking.userId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        // Check if booking has overtime charges
        if (!booking.overtimeDetails || booking.overtimeDetails.overtimePaymentStatus === "success") {
            return next(createHttpError(400, "No pending overtime charges for this booking"));
        }

        // Validate wallet payment if applicable
        if (validatedData.paymentMethod === "wallet") {
            if (!validatedData.walletId) {
                return next(createHttpError(400, "Wallet ID is required for wallet payments"));
            }

            const wallet = await WalletModel.findOne({
                _id: validatedData.walletId,
                userId: userId
            });

            if (!wallet) {
                return next(createHttpError(404, "Wallet not found"));
            }

            if (wallet.balance < booking.overtimeDetails.overtimeAmount) {
                return next(createHttpError(400, "Insufficient wallet balance"));
            }

            // Deduct overtime amount from wallet
            await wallet.debitAmount(
                booking.overtimeDetails.overtimeAmount,
                `Overtime payment for booking ${booking.bookingId}`,
                undefined,
                (booking._id as mongoose.Types.ObjectId).toString(),
                validatedData.transactionReference
            );
        }

        // Update overtime payment details
        booking.overtimeDetails.overtimePaymentStatus = "success";
        booking.overtimeDetails.overtimeTransactionReference = validatedData.transactionReference;
        booking.overtimeDetails.overtimePaymentDate = new Date();
        booking.bookingStatus = "completed";

        await booking.save();

        res.json({
            success: true,
            message: "Overtime payment processed successfully",
            data: {
                bookingId: booking.bookingId,
                overtimeAmount: booking.overtimeDetails.overtimeAmount,
                paymentStatus: booking.overtimeDetails.overtimePaymentStatus,
                newBookingStatus: booking.bookingStatus
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get active bookings for a user (currently checked-in or confirmed)
export const getUserActiveBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const activeBookings = await Booking.findUserActiveBookings(
            new mongoose.Types.ObjectId(userId)
        );
        
        // Populate the results
        await Booking.populate(activeBookings, [
            { path: "propertyId", select: "name address images" },
            { path: "propertyOwnerId", select: "name email phoneNumber" }
        ]);

        res.json({
            success: true,
            data: activeBookings
        });

    } catch (error) {
        next(error);
    }
};

// Get upcoming bookings for a user
export const getUserUpcomingBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const now = new Date();
        const upcomingBookings = await Booking.find({
            userId: new mongoose.Types.ObjectId(userId),
            bookingStatus: "confirmed",
            checkInTime: { $gt: now }
        }).populate([
            { path: "propertyId", select: "name address images" },
            { path: "propertyOwnerId", select: "name email phoneNumber" }
        ]).sort({ checkInTime: 1 });

        res.json({
            success: true,
            data: upcomingBookings
        });

    } catch (error) {
        next(error);
    }
};

// Get booking history for a user
export const getUserBookingHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const { page = 1, limit = 10 } = req.query;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [bookings, total] = await Promise.all([
            Booking.find({
                userId: new mongoose.Types.ObjectId(userId),
                bookingStatus: { $in: ["completed", "cancelled", "no_show"] }
            }).populate([
                { path: "propertyId", select: "name address images" },
                { path: "propertyOwnerId", select: "name email phoneNumber" }
            ]).sort({ checkOutTime: -1 })
            .skip(skip)
            .limit(limitNum),
            Booking.countDocuments({
                userId: new mongoose.Types.ObjectId(userId),
                bookingStatus: { $in: ["completed", "cancelled", "no_show"] }
            })
        ]);

        const totalPages = Math.ceil(total / limitNum);

        res.json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalRecords: total,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

// Advanced search with multiple filters
export const searchBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const searchParams = bookingSearchSchema.parse(req.query);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        // Build base query based on user role
        const baseQuery: any = {};
        
        if (userRole === "admin") {
            // Admin can search all bookings
        } else if (userRole === "propertyOwner") {
            // Property owner can search their properties' bookings
            baseQuery.propertyOwnerId = new mongoose.Types.ObjectId(userId);
        } else {
            // Regular user can only search their own bookings
            baseQuery.userId = new mongoose.Types.ObjectId(userId);
        }

        // Apply search filters
        const query = { ...baseQuery };

        if (searchParams.propertyId) {
            query.propertyId = new mongoose.Types.ObjectId(searchParams.propertyId);
        }

        if (searchParams.userId && userRole === "admin") {
            query.userId = new mongoose.Types.ObjectId(searchParams.userId);
        }

        if (searchParams.propertyOwnerId && userRole === "admin") {
            query.propertyOwnerId = new mongoose.Types.ObjectId(searchParams.propertyOwnerId);
        }

        if (searchParams.bookingStatus) {
            query.bookingStatus = searchParams.bookingStatus;
        }

        if (searchParams.bookingType) {
            query.bookingType = searchParams.bookingType;
        }

        if (searchParams.paymentMethod) {
            query["paymentDetails.paymentMethod"] = searchParams.paymentMethod;
        }

        if (searchParams.paymentStatus) {
            query["paymentDetails.paymentStatus"] = searchParams.paymentStatus;
        }

        // Date range filters
        if (searchParams.checkInDateFrom || searchParams.checkInDateTo) {
            query.checkInTime = {};
            if (searchParams.checkInDateFrom) {
                query.checkInTime.$gte = new Date(searchParams.checkInDateFrom);
            }
            if (searchParams.checkInDateTo) {
                query.checkInTime.$lte = new Date(searchParams.checkInDateTo);
            }
        }

        if (searchParams.bookingDateFrom || searchParams.bookingDateTo) {
            query.bookingDate = {};
            if (searchParams.bookingDateFrom) {
                query.bookingDate.$gte = new Date(searchParams.bookingDateFrom);
            }
            if (searchParams.bookingDateTo) {
                query.bookingDate.$lte = new Date(searchParams.bookingDateTo);
            }
        }

        // Amount range filters
        if (searchParams.minAmount || searchParams.maxAmount) {
            query.totalAmount = {};
            if (searchParams.minAmount) {
                query.totalAmount.$gte = searchParams.minAmount;
            }
            if (searchParams.maxAmount) {
                query.totalAmount.$lte = searchParams.maxAmount;
            }
        }

        // Boolean filters
        if (searchParams.isExtended !== undefined) {
            query.isExtended = searchParams.isExtended;
        }

        if (searchParams.hasRatings !== undefined) {
            if (searchParams.hasRatings) {
                query.ratings = { $exists: true };
            } else {
                query.ratings = { $exists: false };
            }
        }

        // Text search
        if (searchParams.searchTerm) {
            query.$or = [
                { bookingId: { $regex: searchParams.searchTerm, $options: "i" } },
                { "paymentDetails.transactionReference": { $regex: searchParams.searchTerm, $options: "i" } }
            ];
        }

        // Calculate pagination
        const skip = (searchParams.page - 1) * searchParams.limit;

        // Execute query with aggregation for better performance
        const aggregationPipeline = [
            { $match: query },
            {
                $lookup: {
                    from: "properties",
                    localField: "propertyId",
                    foreignField: "_id",
                    as: "property",
                    pipeline: [
                        { $project: { name: 1, address: 1, images: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [
                        { $project: { name: 1, email: 1, phoneNumber: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "propertyOwnerId",
                    foreignField: "_id",
                    as: "propertyOwner",
                    pipeline: [
                        { $project: { name: 1, email: 1, phoneNumber: 1 } }
                    ]
                }
            },
            {
                $addFields: {
                    property: { $arrayElemAt: ["$property", 0] },
                    user: { $arrayElemAt: ["$user", 0] },
                    propertyOwner: { $arrayElemAt: ["$propertyOwner", 0] }
                }
            },
            {
                $sort: { [searchParams.sortBy]: searchParams.sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>
            }
        ];

        const [bookings, totalResult] = await Promise.all([
            Booking.aggregate([
                ...aggregationPipeline,
                { $skip: skip },
                { $limit: searchParams.limit }
            ]),
            Booking.aggregate([
                { $match: query },
                { $count: "total" }
            ])
        ]);

        const total = totalResult[0]?.total || 0;
        const totalPages = Math.ceil(total / searchParams.limit);

        res.json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: searchParams.page,
                    totalPages,
                    totalRecords: total,
                    hasNextPage: searchParams.page < totalPages,
                    hasPrevPage: searchParams.page > 1
                },
                filters: {
                    applied: Object.keys(req.query).length,
                    available: [
                        "propertyId", "userId", "propertyOwnerId", "bookingStatus",
                        "bookingType", "paymentMethod", "paymentStatus",
                        "checkInDateFrom", "checkInDateTo", "bookingDateFrom", "bookingDateTo",
                        "minAmount", "maxAmount", "isExtended", "hasRatings", "searchTerm"
                    ]
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

// Get booking statistics
export const getBookingStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        // Build base match based on user role
        const baseMatch: any = {};
        
        if (userRole === "propertyOwner") {
            baseMatch.propertyOwnerId = new mongoose.Types.ObjectId(userId);
        } else if (userRole !== "admin") {
            baseMatch.userId = new mongoose.Types.ObjectId(userId);
        }

        const statistics = await Booking.aggregate([
            { $match: baseMatch },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: "$totalAmount" },
                    avgBookingValue: { $avg: "$totalAmount" },
                    statusCounts: {
                        $push: "$bookingStatus"
                    },
                    paymentMethodCounts: {
                        $push: "$paymentDetails.paymentMethod"
                    },
                    bookingTypeCounts: {
                        $push: "$bookingType"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalBookings: 1,
                    totalRevenue: 1,
                    avgBookingValue: 1,
                    statusBreakdown: {
                        $arrayToObject: {
                            $map: {
                                input: {
                                    $setUnion: ["$statusCounts", []]
                                },
                                as: "status",
                                in: {
                                    k: "$$status",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$statusCounts",
                                                cond: { $eq: ["$$this", "$$status"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    paymentMethodBreakdown: {
                        $arrayToObject: {
                            $map: {
                                input: {
                                    $setUnion: ["$paymentMethodCounts", []]
                                },
                                as: "method",
                                in: {
                                    k: "$$method",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$paymentMethodCounts",
                                                cond: { $eq: ["$$this", "$$method"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    bookingTypeBreakdown: {
                        $arrayToObject: {
                            $map: {
                                input: {
                                    $setUnion: ["$bookingTypeCounts", []]
                                },
                                as: "type",
                                in: {
                                    k: "$$type",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$bookingTypeCounts",
                                                cond: { $eq: ["$$this", "$$type"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        const result = statistics[0] || {
            totalBookings: 0,
            totalRevenue: 0,
            avgBookingValue: 0,
            statusBreakdown: {},
            paymentMethodBreakdown: {},
            bookingTypeBreakdown: {}
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        next(error);
    }
};

// Get property booking calendar
export const getPropertyBookingCalendar = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { propertyId } = propertyIdParamSchema.parse(req.params);
        const dateRange = dateRangeSchema.parse(req.query);
        const authReq = req as BookingAuthRequest;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;

        if (!userId) {
            return next(createHttpError(401, "Authentication required"));
        }

        // Check if user has access to this property
        const property = await Property.findById(propertyId);
        if (!property) {
            return next(createHttpError(404, "Property not found"));
        }

        if (userRole !== "admin" && property.ownerId.toString() !== userId) {
            return next(createHttpError(403, "Access denied"));
        }

        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);

        const bookings = await Booking.findPropertyBookingsInRange(
            new mongoose.Types.ObjectId(propertyId),
            startDate,
            endDate
        );
        
        // Populate the results
        await Booking.populate(bookings, [
            { path: "userId", select: "name email phoneNumber" }
        ]);
        
        // Sort by check-in time
        bookings.sort((a: any, b: any) => a.checkInTime.getTime() - b.checkInTime.getTime());

        // Group bookings by date for calendar view
        const calendar = bookings.reduce((acc: Record<string, any[]>, booking: any) => {
            const date = booking.checkInTime.toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push({
                bookingId: booking.bookingId,
                userId: booking.userId,
                checkInTime: booking.checkInTime,
                checkOutTime: booking.checkOutTime,
                status: booking.bookingStatus,
                numberOfSeats: booking.numberOfSeats,
                totalAmount: booking.totalAmount
            });
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                propertyId,
                dateRange: {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                },
                calendar,
                totalBookings: bookings.length
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, error.issues.map(issue => issue.message).join(", ")));
        }
        next(error);
    }
};

