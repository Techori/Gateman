import mongoose from "mongoose";

// Sub-schema for policies
const policySchema = new mongoose.Schema({
    guestPolicy: {
        type: String,
        enum: ["allowed", "not_allowed", "with_permission"],
        default: "with_permission"
    },
    eventHostingAllowed: {
        type: Boolean,
        default: false
    },
    smokingPolicy: {
        type: String,
        enum: ["allowed", "not_allowed", "designated_areas"],
        default: "not_allowed"
    },
    petPolicy: {
        type: String,
        enum: ["allowed", "not_allowed", "with_permission"],
        default: "not_allowed"
    },
    foodAndBeveragePolicy: {
        type: String,
        enum: ["allowed", "not_allowed", "outside_food_not_allowed"],
        default: "outside_food_not_allowed"
    }
}, { _id: false });

// Sub-schema for location/accessibility
const locationSchema = new mongoose.Schema({
    nearestMetroStation: {
        type: String,
        trim: true
    },
    distanceFromMetro: {
        type: Number, // distance in kilometers
        min: 0,
        max: 50
    },
    nearestBusStop: {
        type: String,
        trim: true
    },
    distanceFromBusStop: {
        type: Number, // distance in kilometers
        min: 0,
        max: 10
    },
    nearestRailwayStation: {
        type: String,
        trim: true
    },
    distanceFromRailway: {
        type: Number,
        min: 0,
        max: 100
    }
}, { _id: false });

// Sub-schema for pricing structure
const pricingSchema = new mongoose.Schema({
    hourlyRate: {
        type: Number,
        min: 0,
        validate: {
            validator: function (v: number) {
                return v == null || v >= 0;
            },
            message: "Hourly rate must be positive"
        }
    },
    dailyRate: {
        type: Number,
        min: 0,
        validate: {
            validator: function (v: number) {
                return v == null || v >= 0;
            },
            message: "Daily rate must be positive"
        }
    },
    weeklyRate: {
        type: Number,
        min: 0,
        validate: {
            validator: function (v: number) {
                return v == null || v >= 0;
            },
            message: "Weekly rate must be positive"
        }
    },
    monthlyRate: {
        type: Number,
        min: 0,
        validate: {
            validator: function (v: number) {
                return v == null || v >= 0;
            },
            message: "Monthly rate must be positive"
        }
    },
    cleaningFee: {
        type: Number,
        min: 0,
        default: 0
    },
    // Overtime pricing for extended stays
    overtimeHourlyRate: {
        type: Number,
        min: 0,
        default: function (this: any) {
            return this.hourlyRate ? this.hourlyRate * 1.5 : 0;
        }
    }
}, { _id: false });

// Sub-schema for booking rules
const bookingRulesSchema = new mongoose.Schema({
    minBookingHours: {
        type: Number,
        min: 1,
        max: 24,
        default: 1
    },
    maxBookingHours: {
        type: Number,
        min: 1,
        max: 1728, // 72 days * 24 hours
        default: 24
    },
    bufferHours: {
        type: Number,
        min: 0,
        max: 4,
        default: 0.5, // 30 minutes default buffer
        validate: {
            validator: function (v: number) {
                return v % 0.25 === 0; // Allow 15-minute increments
            },
            message: "Buffer hours must be in 15-minute increments"
        }
    },
    allowedTimeSlots: [{
        day: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            required: true
        },
        startTime: {
            type: String, // Format: "09:00"
            required: true,
            validate: {
                validator: function (v: string) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: "Start time must be in HH:MM format"
            }
        },
        endTime: {
            type: String, // Format: "18:00"
            required: true,
            validate: {
                validator: function (v: string) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: "End time must be in HH:MM format"
            }
        },
        isAvailable: {
            type: Boolean,
            default: true
        }
    }],
    advanceBookingDays: {
        type: Number,
        min: 0,
        max: 365,
        default: 30
    },
    // Grace period for checkout (in minutes)
    checkoutGracePeriod: {
        type: Number,
        min: 0,
        max: 60,
        default: 15
    }
}, { _id: false });

// TypeScript interfaces for better type safety
interface IPricing {
    hourlyRate?: number;
    dailyRate?: number;
    weeklyRate?: number;
    monthlyRate?: number;
    cleaningFee?: number;
    overtimeHourlyRate?: number;
}

interface ITimeSlot {
    day: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

interface IBookingRules {
    minBookingHours: number;
    maxBookingHours: number;
    bufferHours: number;
    allowedTimeSlots: ITimeSlot[];
    advanceBookingDays: number;
    checkoutGracePeriod: number;
}

interface IProperty extends mongoose.Document {
    ownerId: mongoose.Types.ObjectId;
    name: string;
    description?: string;
    propertyImages: string[];
    landmark?: string;
    address: string;
    city: string;
    state: string;
    pincode: number;
    googleMapLink?: string;
    totalArea?: number;
    type: string;
    floorSize: number;
    totalFloor: number;
    cost: number;
    amenities: string[];
    isSaturdayOpened: boolean;
    isSundayOpened: boolean;
    seatingCapacity: number;
    totalCostPerSeat: number;
    isPriceNegotiable: boolean;
    unavailableDates: string[];
    furnishingLevel: string;
    propertyStatus: string;
    verificationStatus: string;
    lastInspectionDate?: Date;
    adminNote?: string;
    policies: any;
    location: any;
    pricing: IPricing;
    bookingRules: IBookingRules;
}

const propertySchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            maxlength: [100, "Property name cannot exceed 100 characters"],
            trim: true
        },
        description: {
            type: String,
            maxlength: [2000, "Description cannot exceed 2000 characters"],
            trim: true
        },
        propertyImages: {
            type: [String],
            default: [],
        },
        landmark: {
            type: String,
            trim: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        pincode: {
            type: Number,
            required: true,
            validate: {
                validator: function (v: number) {
                    return /^[1-9][0-9]{5}$/.test(v.toString());
                },
                message: "Please provide a valid 6-digit pincode"
            }
        },
        googleMapLink: {
            type: String,
            validate: {
                validator: function (v: string) {
                    if (!v) return true;
                    return /^https:\/\/(www\.)?google\.(com|co\.in)\/maps/.test(v);
                },
                message: "Please provide a valid Google Maps link"
            }
        },
        totalArea: {
            type: Number,
            min: [1, "Total area must be at least 1 sq ft"]
        },
        type: {
            type: String,
            enum: {
                values: ["DayPass", "Meeting Room", "Coworking Space", "Managed Office", "Virtual office", "Office/Commercial", "Community Hall"],
                message: "Please select a valid property type"
            },
            required: true
        },
        floorSize: {
            type: Number,
            required: true,
            min: [1, "Floor size must be at least 1 sq ft"]
        },
        totalFloor: {
            type: Number,
            required: true,
            min: [1, "Total floors must be at least 1"]
        },
        cost: {
            type: Number,
            required: true,
            min: [0, "Cost cannot be negative"]
        },
        amenities: {
            type: [String],
            required: true,
        },
        isSaturdayOpened: {
            type: Boolean,
            required: true
        },
        isSundayOpened: {
            type: Boolean,
            required: true
        },
        seatingCapacity: {
            type: Number,
            required: true,
            min: [1, "Seating capacity must be at least 1"]
        },
        totalCostPerSeat: {
            type: Number,
            required: true,
            min: [0, "Cost per seat cannot be negative"]
        },
        isPriceNegotiable: {
            type: Boolean,
            required: true
        },
        unavailableDates: {
            type: [String],
            default: [],
        },
        furnishingLevel: {
            type: String,
            enum: ["unfurnished", "semi_furnished", "fully_furnished"],
            default: "semi_furnished"
        },
        propertyStatus: {
            type: String,
            enum: ["active", "inactive", "under_maintenance"],
            default: "inactive",
        },
        verificationStatus: {
            type: String,
            enum: ["verified", "notVerified", "pending"],
            default: "pending",
            required: true,
        },
        lastInspectionDate: {
            type: Date,
        },
        adminNote: {
            type: String,
            maxlength: [1000, "Admin note cannot exceed 1000 characters"]
        },
        policies: {
            type: policySchema,
            default: () => ({})
        },
        location: {
            type: locationSchema,
            default: () => ({})
        },
        pricing: {
            type: pricingSchema,
            default: () => ({})
        },
        bookingRules: {
            type: bookingRulesSchema,
            default: () => ({
                minBookingHours: 1,
                maxBookingHours: 24,
                bufferHours: 0.5, // 30 minutes default
                allowedTimeSlots: [],
                advanceBookingDays: 30,
                checkoutGracePeriod: 15
            })
        }
    },
    {
        timestamps: true,
        indexes: [
            { ownerId: 1 },
            { city: 1, state: 1 },
            { type: 1 },
            { propertyStatus: 1 },
            { verificationStatus: 1 },
            { "pricing.hourlyRate": 1 },
            { "pricing.dailyRate": 1 },
            { seatingCapacity: 1 }
        ]
    }
);

// Validation to ensure at least one pricing option is provided
propertySchema.pre('save', function (this: IProperty, next) {
    const { hourlyRate, dailyRate, weeklyRate, monthlyRate } = this.pricing;

    if (!hourlyRate && !dailyRate && !weeklyRate && !monthlyRate) {
        return next(new Error('At least one pricing option (hourly, daily, weekly, or monthly) is required'));
    }

    next();
});

// Method to check if property is available for booking on a specific date and time
propertySchema.methods.isAvailableForBooking = function (this: IProperty, date: string, startTime: string, endTime: string) {
    // Fix: Use 'long' instead of 'lowercase' and then convert to lowercase
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Check if date is in unavailable dates
    if (this.unavailableDates.includes(date)) {
        return false;
    }

    // Check if property is active
    if (this.propertyStatus !== 'active') {
        return false;
    }

    // Check allowed time slots for the day
    const daySlots = this.bookingRules.allowedTimeSlots.filter((slot: ITimeSlot) =>
        slot.day === dayOfWeek && slot.isAvailable
    );

    if (daySlots.length === 0) {
        return false;
    }

    // Check if requested time falls within allowed slots
    return daySlots.some((slot: ITimeSlot) => {
        return startTime >= slot.startTime && endTime <= slot.endTime;
    });
};

// Method to get available pricing options
propertySchema.methods.getAvailablePricingOptions = function (this: IProperty) {
    const options = [];
    const { hourlyRate, dailyRate, weeklyRate, monthlyRate } = this.pricing;

    if (hourlyRate) options.push({ type: 'hourly', rate: hourlyRate });
    if (dailyRate) options.push({ type: 'daily', rate: dailyRate });
    if (weeklyRate) options.push({ type: 'weekly', rate: weeklyRate });
    if (monthlyRate) options.push({ type: 'monthly', rate: monthlyRate });

    return options;
};

// Method to calculate pricing for a booking
propertySchema.methods.calculateBookingPrice = function (this: IProperty, bookingType: string, hours: number, seats: number = 1) {
    let baseRate = 0;

    switch (bookingType) {
        case 'hourly':
            baseRate = this.pricing.hourlyRate || 0;
            break;
        case 'daily':
            baseRate = this.pricing.dailyRate || 0;
            break;
        case 'weekly':
            baseRate = this.pricing.weeklyRate || 0;
            break;
        case 'monthly':
            baseRate = this.pricing.monthlyRate || 0;
            break;
        default:
            throw new Error('Invalid booking type');
    }

    if (!baseRate) {
        throw new Error(`${bookingType} rate not available for this property`);
    }

    let multiplier = 1;
    if (bookingType === 'hourly') {
        multiplier = hours;
    } else if (bookingType === 'daily') {
        multiplier = Math.ceil(hours / 24);
    } else if (bookingType === 'weekly') {
        multiplier = Math.ceil(hours / (24 * 7));
    } else if (bookingType === 'monthly') {
        multiplier = Math.ceil(hours / (24 * 30));
    }

    const baseAmount = baseRate * multiplier * seats;
    const cleaningFee = this.pricing.cleaningFee || 0;

    return {
        baseAmount,
        cleaningFee,
        subtotal: baseAmount + cleaningFee,
        totalAmount: baseAmount + cleaningFee
    };
};

// Method to get overtime rate
propertySchema.methods.getOvertimeRate = function (this: IProperty) {
    return this.pricing.overtimeHourlyRate || ((this.pricing.hourlyRate || 0) * 1.5) || 0;
};

// Method to check if property allows weekend bookings
propertySchema.methods.isWeekendBookingAllowed = function (this: IProperty, date: string) {
    const dayOfWeek = new Date(date).getDay();

    if (dayOfWeek === 6) { // Saturday
        return this.isSaturdayOpened;
    }

    if (dayOfWeek === 0) { // Sunday
        return this.isSundayOpened;
    }

    return true; // Weekdays are generally allowed
};

// Method to get property's buffer time in minutes
propertySchema.methods.getBufferTimeMinutes = function (this: IProperty) {
    return this.bookingRules.bufferHours * 60;
};

// Static method to find available properties based on criteria
propertySchema.statics.findAvailableProperties = function (criteria: {
    city?: string;
    state?: string;
    type?: string;
    seatingCapacity?: number;
    priceRange?: { min: number; max: number };
    date?: string;
    startTime?: string;
    endTime?: string;
}) {
    let query: any = {
        propertyStatus: 'active',
        verificationStatus: 'verified'
    };

    if (criteria.city) {
        query.city = new RegExp(criteria.city, 'i');
    }

    if (criteria.state) {
        query.state = new RegExp(criteria.state, 'i');
    }

    if (criteria.type) {
        query.type = criteria.type;
    }

    if (criteria.seatingCapacity) {
        query.seatingCapacity = { $gte: criteria.seatingCapacity };
    }

    if (criteria.priceRange) {
        query.$or = [
            { 'pricing.hourlyRate': { $gte: criteria.priceRange.min, $lte: criteria.priceRange.max } },
            { 'pricing.dailyRate': { $gte: criteria.priceRange.min, $lte: criteria.priceRange.max } }
        ];
    }

    return this.find(query);
};

export const Property = mongoose.model<IProperty>("Property", propertySchema);