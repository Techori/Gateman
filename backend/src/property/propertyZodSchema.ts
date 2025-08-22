import { z } from "zod";

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
}).refine(data => {
    // Custom validation: if googleMapLink is provided, it should be a valid URL
    if (data.googleMapLink && data.googleMapLink !== "") {
        try {
            new URL(data.googleMapLink);
            return true;
        } catch {
            return false;
        }
    }
    return true;
}, {
    message: "Invalid Google Maps link format",
    path: ["googleMapLink"]
})
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

export { 
    createPropertySchema, 
    updatePropertySchema, 
    adminPropertyActionSchema,
    propertyFilterSchema 
};