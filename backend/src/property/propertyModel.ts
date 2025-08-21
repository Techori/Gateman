import mongoose from "mongoose";


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
        },
        description: {
            type: String,

        },
        propertyImages: {
            type: [String],
            default: [],
        },
        landmark: {
            type: String,

        },
        address: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            required: true,
        },
        pincode: {
            type: Number,
            required: true,
        },
        googleMapLink: {
            type: String,
        },
        totalArea: {
            type: Number,
        },
        // DayPass, Meeting Room ,Coworking Space , Managed Office , Virtual office , office/commercial,community halls
        type: {
            type: String,
            enum: ["DayPass", "Meeting Room", "Coworking Space", "Managed Office", "Virtual office", "Office/Commercial", "Community Hall"],
        },
        floorSize: {
            type: Number,
            required: true,
        },
        totalFloor: {
            type: Number,
            required: true,
        },
        cost: {
            type: Number,
            required: true
        },

        // 2 wheeler parking, 4 wheeler parking , Fire Extinguisher, Security Personnel, First Aid Kit, private cabins pantry reception area

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
            required: true
        },
        totalCostPerSeat: {
            type: Number,
            required: true
        },
        isPriceNegotiable: {
            type: Boolean,
            required: true
        },
        // "unavailableDates": ["2025-08-21", "2025-08-22", "2025-08-25"]
        unavailableDates: {
            type: [String], // store as array of ISO strings
            default: [],
        },
        furnishingLevel: {
            type: String,
        },
        propertyStatus: {
            type: String,
            enum: ["active", "inactive", "under_maintenance"],
            default: "active",
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
        },
    },
    { timestamps: true }
);

export const Property = mongoose.model("Property", propertySchema);
