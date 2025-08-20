import { z } from "zod";


const createPropertySchema = z.object({
    ownerId: z.string().trim(),
    name: z.string().trim(),
    description: z.string().trim(),
    location: z.string().trim(),
    city: z.string().trim(),
    address: z.string().trim(),
    state: z.string().trim(),
    pincode: z.number(),
    googleMapLink: z.string().optional(),
    totalArea: z.string().optional(),
    type: z.string().optional(),
    totalSpaces: z.number().min(1, "Total spaces required"),
    amenities: z.array(z.string()).nonempty("Amenities are required"),
    propertyStatus: z.enum(["active", "inactive", "under_maintenance"]),
    verificationStatus: z.enum(["verified", "notVerified", "pending"]),
    lastInspectionDate: z.date().optional(),
    adminNote: z.string().optional(),
})

export {createPropertySchema}