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
        type: {
            type: String,
        },
        totalSpaces: {
            type: Number,
            required: true,
        },
        // Spaces for gatherings like community halls, lounges, and meeting rooms
        amenities: {
            type: [String],
            required: true,
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
