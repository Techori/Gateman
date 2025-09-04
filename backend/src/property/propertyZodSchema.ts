import { z } from "zod";

// const createPropertySchema = z.object({
//     name: z.string().trim().min(1, "Property name is required"),
//     description: z.string().trim().optional(),
//     landmark: z.string().trim().optional(),
//     address: z.string().trim().min(1, "Address is required"),
//     city: z.string().trim().min(1, "City is required"),
//     state: z.string().trim().min(1, "State is required"),
//     pincode: z.coerce.number().int().min(100000).max(999999, "Invalid pincode"),
//     googleMapLink: z.string().url().optional().or(z.literal("")),
//     totalArea: z.coerce.number().positive().optional(),
//     type: z.enum([
//         "DayPass",
//         "Meeting Room",
//         "Coworking Space",
//         "Managed Office",
//         "Virtual office",
//         "Office/Commercial",
//         "Community Hall"
//     ]).optional(),
//     floorSize: z.coerce.number().positive("Floor size must be positive"),
//     totalFloor: z.coerce.number().int().positive("Total floors must be positive"),
//     cost: z.coerce.number().positive("Cost must be positive"),
//     amenities: z.array(z.string().trim()).nonempty("At least one amenity is required"),
//     isSaturdayOpened: z.coerce.boolean(),
//     isSundayOpened: z.coerce.boolean(),
//     seatingCapacity: z.coerce.number().int().positive("Seating capacity must be positive"),
//     totalCostPerSeat: z.coerce.number().positive("Cost per seat must be positive"),
//     isPriceNegotiable: z.coerce.boolean(),
//     unavailableDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")).optional(),
//     furnishingLevel: z.string().trim().optional(),
//     propertyStatus: z.enum(["active", "inactive", "under_maintenance"]).default("active"),
//     verificationStatus: z.enum(["verified", "notVerified", "pending"]).default("pending"),
//     lastInspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
//     adminNote: z.string().trim().optional(),
// }).refine(data => {
//     // Custom validation: if googleMapLink is provided, it should be a valid URL
//     if (data.googleMapLink && data.googleMapLink !== "") {
//         try {
//             new URL(data.googleMapLink);
//             return true;
//         } catch {
//             return false;
//         }
//     }
//     return true;
// }, {
//     message: "Invalid Google Maps link format",
//     path: ["googleMapLink"]
// })
/*
.refine(data => {
    // Validate that cost per seat makes sense compared to total cost
    if (data.totalCostPerSeat && data.cost && data.seatingCapacity) {
        const expectedTotalCost = data.totalCostPerSeat * data.seatingCapacity;
        // Allow some flexibility (within 10% difference)
        const tolerance = 0.1;
        return Math.abs(expectedTotalCost - data.cost) <= (data.cost * tolerance);
    }
    return true;
}, {
    message: "Cost per seat doesn't match with total cost and seating capacity",
    path: ["totalCostPerSeat"]
});
*/

const timeSlotSchema = z.object({
    day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
    isAvailable: z.boolean().default(true)
}).refine(data => data.startTime < data.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"]
});

const pricingSchema = z.object({
    hourlyRate: z.coerce.number().positive().optional(),
    dailyRate: z.coerce.number().positive().optional(),
    weeklyRate: z.coerce.number().positive().optional(),
    monthlyRate: z.coerce.number().positive().optional(),
    cleaningFee: z.coerce.number().min(0).default(0),
    overtimeHourlyRate: z.coerce.number().positive().optional()
}).refine(data => {
    return data.hourlyRate || data.dailyRate || data.weeklyRate || data.monthlyRate;
}, {
    message: "At least one pricing option is required",
    path: ["hourlyRate"]
});

const policiesSchema = z.object({
    guestPolicy: z.enum(["allowed", "not_allowed", "with_permission"]).default("with_permission"),
    eventHostingAllowed: z.boolean().default(false),
    smokingPolicy: z.enum(["allowed", "not_allowed", "designated_areas"]).default("not_allowed"),
    petPolicy: z.enum(["allowed", "not_allowed", "with_permission"]).default("not_allowed"),
    foodAndBeveragePolicy: z.enum(["allowed", "not_allowed", "outside_food_not_allowed"]).default("outside_food_not_allowed")
});

const locationSchema = z.object({
    nearestMetroStation: z.string().trim().optional(),
    distanceFromMetro: z.coerce.number().min(0).max(50).optional(),
    nearestBusStop: z.string().trim().optional(),
    distanceFromBusStop: z.coerce.number().min(0).max(10).optional(),
    nearestRailwayStation: z.string().trim().optional(),
    distanceFromRailway: z.coerce.number().min(0).max(100).optional()
});

const bookingRulesSchema = z.object({
    minBookingHours: z.coerce.number().min(1).max(24).default(1),
    maxBookingHours: z.coerce.number().min(1).max(1728).default(24),
    bufferHours: z.coerce.number().min(0).max(4).default(0.5),
    allowedTimeSlots: z.array(timeSlotSchema).default([]),
    checkoutGracePeriod: z.coerce.number().min(0).max(60).default(15)
});

// Update your createPropertySchema to include these:
const createPropertySchema = z.object({
    name: z.string().trim().min(1, "Property name is required"),
    description: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
    address: z.string().trim().min(1, "Address is required"),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pincode: z.coerce.number().int().min(100000).max(999999, "Invalid pincode"),
    googleMapLink: z.string().url().optional().or(z.literal("")),
    totalArea: z.coerce.number().positive().optional(),
    type: z.enum([
        "DayPass",
        "Meeting Room",
        "Coworking Space",
        "Managed Office",
        "Virtual office",
        "Office/Commercial",
        "Community Hall"
    ]).optional(),
    floorSize: z.coerce.number().positive("Floor size must be positive"),
    totalFloor: z.coerce.number().int().positive("Total floors must be positive"),
    cost: z.coerce.number().positive("Cost must be positive"),
    amenities: z.array(z.string().trim()).nonempty("At least one amenity is required"),
    isSaturdayOpened: z.coerce.boolean(),
    isSundayOpened: z.coerce.boolean(),
    seatingCapacity: z.coerce.number().int().positive("Seating capacity must be positive"),
    totalCostPerSeat: z.coerce.number().positive("Cost per seat must be positive"),
    isPriceNegotiable: z.coerce.boolean(),
    unavailableDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")).optional(),
    furnishingLevel: z.string().trim().optional(),
    propertyStatus: z.enum(["active", "inactive", "under_maintenance"]).default("active"),
    verificationStatus: z.enum(["verified", "notVerified", "pending"]).default("pending"),
    lastInspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
    adminNote: z.string().trim().optional(),
    // Add the new nested schemas
    pricing: pricingSchema,
    policies: policiesSchema,
    location: locationSchema,
    bookingRules: bookingRulesSchema
});

// Schema for updating property (makes most fields optional)
const updatePropertySchema = createPropertySchema.partial().extend({
    propertyId: z.string().min(1, "Property ID is required")
});

// Schema for admin actions
const adminPropertyActionSchema = z.object({
    propertyId: z.string().min(1, "Property ID is required"),
    verificationStatus: z.enum(["verified", "notVerified", "pending"]).optional(),
    propertyStatus: z.enum(["active", "inactive", "under_maintenance"]).optional(),
    adminNote: z.string().trim().optional(),
    lastInspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
});

// Schema for public property search/filter
const propertyFilterSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    type: z.enum([
        "DayPass",
        "Meeting Room",
        "Coworking Space",
        "Managed Office",
        "Virtual office",
        "Office/Commercial",
        "Community Hall"
    ]).optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    minCost: z.coerce.number().positive().optional(),
    maxCost: z.coerce.number().positive().optional(),
    seatingCapacity: z.coerce.number().int().positive().optional(),
    amenities: z.union([
        z.string(),
        z.array(z.string())
    ]).optional(),
    status: z.enum(["active", "inactive", "under_maintenance"]).optional(),
    verificationStatus: z.enum(["verified", "notVerified", "pending"]).optional(),
}).refine(data => {
    // Ensure minCost is less than maxCost if both are provided
    if (data.minCost && data.maxCost) {
        return data.minCost <= data.maxCost;
    }
    return true;
}, {
    message: "Minimum cost must be less than or equal to maximum cost",
    path: ["minCost"]
});

const pageAndLimitSchema = z.object({
    page: z.number().positive(),
    limit: z.number().positive()
})
const pageAndLimitTypeSchema = z.object({
    page: z.number().positive(),
    limit: z.number().positive(),
    type: z.string().min(1, "property type is required")
})
const pageAndLimitCitySchema = z.object({
    page: z.number().positive(),
    limit: z.number().positive(),
    city: z.string().min(1, " city is required")
})
const pageAndLimitCityAndTypeSchema = z.object({
    page: z.number().positive(),
    limit: z.number().positive(),
    city: z.string().min(1, " city is required"),
    type: z.string().min(1, "property type is required")
})
const propertyStausSchema = z.object({
    verificationStatus: z.enum(["verified", "notVerified", "pending"]).default("pending"),
    page: z.number().positive(),
    limit: z.number().positive(),
})
const propertyStausSchemawithType = z.object({
    verificationStatus: z.enum(["verified", "notVerified", "pending"]).default("pending"),
    page: z.number().positive(),
    limit: z.number().positive(),
    type: z.string().min(1, "property type is required")
})

const priceRangeSchema = z.object({
    lowestPrice: z.coerce.number().min(0, "Lowest price must be non-negative"),
    highestPrice: z.coerce.number().min(0, "Highest price must be non-negative"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10)
}).refine(data => data.lowestPrice <= data.highestPrice, {
    message: "Lowest price must be less than or equal to highest price",
    path: ["lowestPrice"]
});
const distanceFilterSchema = z.object({
    // Transportation filters - at least one must be provided
    metroDistance: z.coerce.number().min(0).max(50).optional(),
    busStopDistance: z.coerce.number().min(0).max(20).optional(),
    railwayDistance: z.coerce.number().min(0).max(100).optional(),
    
    // Pagination
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    
    // Optional additional filters
    city: z.string().trim().optional(),
    type: z.enum([
        "DayPass",
        "Meeting Room",
        "Coworking Space",
        "Managed Office",
        "Virtual office",
        "Office/Commercial",
        "Community Hall"
    ]).optional()
}).refine(data => {
    // At least one distance filter must be provided
    return data.metroDistance !== undefined || 
           data.busStopDistance !== undefined || 
           data.railwayDistance !== undefined;
}, {
    message: "At least one distance filter (metroDistance, busStopDistance, or railwayDistance) must be provided",
    path: ["metroDistance"]
});

export {
    createPropertySchema,
    updatePropertySchema,
    adminPropertyActionSchema,
    propertyFilterSchema,
    pageAndLimitSchema,
    pageAndLimitTypeSchema,
    pageAndLimitCitySchema,
    pageAndLimitCityAndTypeSchema,
    propertyStausSchema,
    propertyStausSchemawithType,
    priceRangeSchema,
    distanceFilterSchema
};