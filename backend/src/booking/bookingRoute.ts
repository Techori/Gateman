import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import {
    createBooking,
    getBookingById,
    getBookingByBookingId,
    updateBooking,
    deleteBooking,
    getUserBookings,
    getPropertyOwnerBookings,
    checkAvailability,
    getBookingAnalytics,
    checkInBooking,
    checkOutBooking,
    cancelBooking,
    addBookingRating,
    updateBookingStatus,
    processOvertimePayment,
    getUserActiveBookings,
    getUserUpcomingBookings,
    getUserBookingHistory,
    searchBookings,
    getBookingStatistics,
    getPropertyBookingCalendar
} from "./bookingController.js";

const bookingRouter = express.Router();

// Public routes (no authentication required)
/**
 * @route GET /api/bookings/availability
 * @desc Check property availability for booking
 * @access Public
 */
bookingRouter.get("/availability", checkAvailability);

/**
 * @route GET /api/bookings/search
 * @desc Advanced search for bookings with multiple filters
 * @access Private
 */
bookingRouter.get("/search", authenticate, searchBookings);

/**
 * @route GET /api/bookings/statistics
 * @desc Get booking statistics
 * @access Private
 */
bookingRouter.get("/statistics", authenticate, getBookingStatistics);

/**
 * @route GET /api/bookings/property/:propertyId/calendar
 * @desc Get property booking calendar
 * @access Private
 */
bookingRouter.get("/property/:propertyId/calendar", authenticate, getPropertyBookingCalendar);

// Protected routes (authentication required)
/**
 * @route POST /api/bookings
 * @desc Create a new booking
 * @access Private
 */
bookingRouter.post("/", authenticate, createBooking);

/**
 * @route GET /api/bookings/user/active
 * @desc Get user's active bookings (confirmed, checked-in)
 * @access Private
 */
bookingRouter.get("/user/active", authenticate, getUserActiveBookings);

/**
 * @route GET /api/bookings/user/upcoming
 * @desc Get user's upcoming bookings
 * @access Private
 */
bookingRouter.get("/user/upcoming", authenticate, getUserUpcomingBookings);

/**
 * @route GET /api/bookings/user/history
 * @desc Get user's booking history (completed, cancelled, no-show)
 * @access Private
 */
bookingRouter.get("/user/history", authenticate, getUserBookingHistory);

/**
 * @route GET /api/bookings/user
 * @desc Get user's bookings with filters
 * @access Private
 */
bookingRouter.get("/user", authenticate, getUserBookings);

/**
 * @route GET /api/bookings/owner
 * @desc Get property owner's bookings with filters
 * @access Private
 */
bookingRouter.get("/owner", authenticate, getPropertyOwnerBookings);

/**
 * @route GET /api/bookings/analytics
 * @desc Get booking analytics for property owner
 * @access Private
 */
bookingRouter.get("/analytics", authenticate, getBookingAnalytics);

/**
 * @route GET /api/bookings/booking-id/:bookingId
 * @desc Get booking by booking ID
 * @access Private
 */
bookingRouter.get("/booking-id/:bookingId", authenticate, getBookingByBookingId);

/**
 * @route GET /api/bookings/:id
 * @desc Get booking by ID
 * @access Private
 */
bookingRouter.get("/:id", authenticate, getBookingById);

/**
 * @route PUT /api/bookings/:id
 * @desc Update booking (before check-in only)
 * @access Private
 */
bookingRouter.put("/:id", authenticate, updateBooking);

/**
 * @route DELETE /api/bookings/:id
 * @desc Delete booking (pending payments only)
 * @access Private
 */
bookingRouter.delete("/:id", authenticate, deleteBooking);

// Booking management routes
/**
 * @route POST /api/bookings/:id/check-in
 * @desc Check-in to a booking
 * @access Private
 */
bookingRouter.post("/:id/check-in", authenticate, checkInBooking);

/**
 * @route POST /api/bookings/:id/check-out
 * @desc Check-out from a booking
 * @access Private
 */
bookingRouter.post("/:id/check-out", authenticate, checkOutBooking);

/**
 * @route POST /api/bookings/:id/cancel
 * @desc Cancel a booking
 * @access Private
 */
bookingRouter.post("/:id/cancel", authenticate, cancelBooking);

/**
 * @route POST /api/bookings/:id/rating
 * @desc Add rating and review to a booking
 * @access Private
 */
bookingRouter.post("/:id/rating", authenticate, addBookingRating);

/**
 * @route POST /api/bookings/:id/overtime-payment
 * @desc Process overtime payment for extended booking
 * @access Private
 */
bookingRouter.post("/:id/overtime-payment", authenticate, processOvertimePayment);

// Admin routes
/**
 * @route PUT /api/bookings/:id/status
 * @desc Update booking status (Admin only)
 * @access Private (Admin)
 */
bookingRouter.put("/:id/status", authenticate, updateBookingStatus);

export default bookingRouter;