import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z, ZodError } from "zod";
import path from "node:path";
import fs from "node:fs";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { createPropertySchema } from "./propertyZodSchema.js";
import { Property } from "./propertyModel.js";
import { User } from "../user/userModel.js";
import cloudinary from "../config/cloudinary.js";

// Helper function to check if file exists
// const checkFileExists = async (filePath: string): Promise<boolean> => {
//     try {
//         await fs.promises.access(filePath, fs.constants.F_OK);
//         return true;
//     } catch {
//         return false;
//     }
// };

// // Helper function to safely delete file
// const safeDeleteFile = async (filePath: string): Promise<void> => {
//     try {
//         if (await checkFileExists(filePath)) {
//             await fs.promises.unlink(filePath);
//             console.log(`Successfully deleted: ${filePath}`);
//         }
//     } catch (error) {
//         console.log(`Error deleting file ${filePath}:`, (error as Error).message);
//     }
// };

// // Get file path - use the file path from multer if available, otherwise construct it
// const getFilePath = (file: Express.Multer.File): string => {
//     if (file.path) {
//         return file.path; // Use the path provided by multer
//     }
//     // Fallback to constructed path
//     return path.resolve(
//         process.cwd(),
//         "public/data/uploads",
//         file.filename
//     );
// };

// // Upload single image to Cloudinary
// const uploadImageToCloudinary = async (
//     filePath: string,
//     filename: string
// ): Promise<{ url: string; public_id: string }> => {
//     try {
//         const result = await cloudinary.uploader.upload(filePath, {
//             filename_override: filename,
//             folder: "PropertyImages",
//             resource_type: "image",
//             transformation: [
//                 { width: 1200, height: 800, crop: "limit" },
//                 { quality: "auto:good" }
//             ]
//         });

//         return {
//             url: result.secure_url,
//             public_id: result.public_id
//         };
//     } catch (error) {
//         console.error("Cloudinary upload error:", error);
//         throw new Error("Failed to upload image to Cloudinary");
//     }
// };

// const createProperty = async (req: Request, res: Response, next: NextFunction) => {
//     const filesToDelete: string[] = []; // Track files to delete

//     try {
//         // Pre-process the request body to handle FormData JSON strings
//         const processedBody = { ...req.body };

//         // Handle amenities - parse JSON string back to array
//         if (req.body.amenities && typeof req.body.amenities === 'string') {
//             try {
//                 processedBody.amenities = JSON.parse(req.body.amenities);
//             } catch (error) {
//                 console.error('Error parsing amenities JSON:', error);
//                 processedBody.amenities = []; // Default to empty array if parsing fails
//             }
//         }

//         // Handle unavailableDates - parse JSON string back to array
//         if (req.body.unavailableDates && typeof req.body.unavailableDates === 'string') {
//             try {
//                 processedBody.unavailableDates = JSON.parse(req.body.unavailableDates);
//             } catch (error) {
//                 console.error('Error parsing unavailableDates JSON:', error);
//                 processedBody.unavailableDates = []; // Default to empty array if parsing fails
//             }
//         }

//         console.log('Processed body:', processedBody); // Debug log

//         // Parse and validate request body
//         const validatedData = createPropertySchema.parse(processedBody);
//         const {
//             name,
//             description,
//             landmark,
//             address,
//             city,
//             state,
//             pincode,
//             googleMapLink,
//             totalArea,
//             type,
//             floorSize,
//             totalFloor,
//             cost,
//             amenities,
//             isSaturdayOpened,
//             isSundayOpened,
//             seatingCapacity,
//             totalCostPerSeat,
//             isPriceNegotiable,
//             unavailableDates,
//             furnishingLevel,
//             propertyStatus,
//             verificationStatus,
//             lastInspectionDate,
//             adminNote
//         } = validatedData;

//         const _req = req as AuthRequest;
//         const { _id, sessionId, isAccessTokenExp } = _req;
//         const files = req.files as { [fieldname: string]: Express.Multer.File[] };

//         console.log("Received files:", files);

//         // Validate user
//         const user = await User.findById(_id).select("-password");
//         if (!user) {
//             return next(createHttpError(404, "User not found"));
//         }

//         // Validate session
//         if (!user.isSessionValid(sessionId)) {
//             return next(createHttpError(401, "Invalid or expired session"));
//         }

//         if (!user.isEmailVerify) {
//             return next(createHttpError(401, "User email is not verified"));
//         }

//         // only user role = propertyOwener is allowed
//         if (user.role !== "propertyOwener") {
//             return next(createHttpError(401, "You are not allowed for this request"));
//         }
//         // Handle access token expiration and session update
//         let newAccessToken = null;
//         let newRefreshToken = null;

//         if (isAccessTokenExp) {
//             // Update session activity (this may extend the session and generate new refresh token)
//             const updateResult = user.updateSessionActivity(sessionId);

//             // Generate new access token
//             newAccessToken = user.generateAccessToken(sessionId);

//             // If session was extended, we get a new refresh token
//             if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
//                 newRefreshToken = updateResult.newRefreshToken;
//             }

//             // Save user with updated session
//             await user.save({ validateBeforeSave: false });
//         }

//         // Check if property images are provided
//         if (!files || !files.propertyImage || files.propertyImage.length === 0) {
//             return next(createHttpError(400, "At least one property image is required"));
//         }


//         const propertyImages = files.propertyImage;

//         // Validate number of images (max 5)
//         if (propertyImages.length > 5) {
//             return next(createHttpError(400, "Maximum 5 images are allowed"));
//         }

//         // Get file paths and add to deletion tracking
//         const imagePaths: string[] = [];
//         for (const file of propertyImages) {
//             const path = getFilePath(file);
//             if (path) {
//                 imagePaths.push(path);
//                 filesToDelete.push(path);
//             }
//         }

//         console.log("Image paths:", imagePaths);

//         // Check if all files exist
//         const fileChecks = await Promise.all(
//             imagePaths.map(async (path, index) => ({
//                 path,
//                 exists: await checkFileExists(path),
//                 index
//             }))
//         );

//         const missingFiles = fileChecks.filter(check => !check.exists);
//         if (missingFiles.length > 0) {
//             return next(createHttpError(400, `Files not found: ${missingFiles.map(f => `image ${f.index + 1}`).join(', ')}`));
//         }

//         // Upload images to Cloudinary
//         const uploadPromises = imagePaths.map((filePath, index) =>
//             uploadImageToCloudinary(filePath, propertyImages[index]?.filename || `property_image_${Date.now()}_${index}`)
//         );

//         let uploadResults: { url: string; public_id: string }[] = [];

//         try {
//             console.log("Uploading images to Cloudinary...");
//             uploadResults = await Promise.all(uploadPromises);
//             console.log("Upload results:", uploadResults);
//         } catch (uploadError) {
//             console.error("Error uploading images:", uploadError);
//             return next(createHttpError(500, "Failed to upload images to Cloudinary"));
//         }

//         // Create property in database
//         const newProperty = new Property({
//             ownerId: _id, // Use authenticated user's ID
//             name,
//             description,
//             propertyImages: uploadResults.map(result => result.url), // Store Cloudinary URLs
//             landmark,
//             address,
//             city,
//             state,
//             pincode,
//             googleMapLink,
//             totalArea: totalArea ? Number(totalArea) : undefined,
//             type,
//             floorSize: Number(floorSize),
//             totalFloor: Number(totalFloor),
//             cost: Number(cost),
//             amenities,
//             isSaturdayOpened: Boolean(isSaturdayOpened),
//             isSundayOpened: Boolean(isSundayOpened),
//             seatingCapacity: Number(seatingCapacity),
//             totalCostPerSeat: Number(totalCostPerSeat),
//             isPriceNegotiable: Boolean(isPriceNegotiable),
//             unavailableDates: unavailableDates || [],
//             furnishingLevel,
//             propertyStatus,
//             verificationStatus,
//             lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : undefined,
//             adminNote
//         });

//         const savedProperty = await newProperty.save();

//         // Clean up local files after successful upload
//         await Promise.all(filesToDelete.map(safeDeleteFile));

//         // Update session activity
//         user.updateSessionActivity(sessionId);
//         await user.save({ validateBeforeSave: false });

//         res.status(201).json({
//             success: true,
//             message: "Property created successfully",
//             data: {
//                 propertyId: savedProperty._id,
//                 name: savedProperty.name,
//                 propertyImages: savedProperty.propertyImages,
//                 verificationStatus: savedProperty.verificationStatus,
//                 propertyStatus: savedProperty.propertyStatus,

//             },
//             isAccessTokenExp,
//             accessToken:isAccessTokenExp?newAccessToken:null,
//             refreshToken:isAccessTokenExp?newRefreshToken:null
//         });

//     } catch (error) {
//         console.error("Create property error:", error);

//         // Clean up uploaded files in case of error
//         await Promise.all(filesToDelete.map(safeDeleteFile));

//         if (error instanceof ZodError) {
//             return next(createHttpError(400, "Invalid property data", { cause: error }));
//         }

//         if (error instanceof Error) {
//             return next(createHttpError(500, error.message));
//         }

//         next(createHttpError(500, "Internal server error while creating property"));
//     }
// };

const checkFileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

// Helper function to safely delete file
const safeDeleteFile = async (filePath: string): Promise<void> => {
    try {
        if (await checkFileExists(filePath)) {
            await fs.promises.unlink(filePath);
            console.log(`Successfully deleted: ${filePath}`);
        }
    } catch (error) {
        console.log(`Error deleting file ${filePath}:`, (error as Error).message);
    }
};

// Get file path - use the file path from multer if available, otherwise construct it
const getFilePath = (file: Express.Multer.File): string => {
    if (file.path) {
        return file.path; // Use the path provided by multer
    }
    // Fallback to constructed path
    return path.resolve(
        process.cwd(),
        "public/data/uploads",
        file.filename
    );
};

// Upload single image to Cloudinary
const uploadImageToCloudinary = async (
    filePath: string,
    filename: string
): Promise<{ url: string; public_id: string }> => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            filename_override: filename,
            folder: "PropertyImages",
            resource_type: "image",
            transformation: [
                { width: 1200, height: 800, crop: "limit" },
                { quality: "auto:good" }
            ]
        });

        return {
            url: result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Failed to upload image to Cloudinary");
    }
};

const createProperty = async (req: Request, res: Response, next: NextFunction) => {
    const filesToDelete: string[] = []; // Track files to delete

    try {
        // Pre-process the request body to handle FormData JSON strings
        const processedBody = { ...req.body };

        // Handle amenities - parse JSON string back to array
        if (req.body.amenities && typeof req.body.amenities === 'string') {
            try {
                processedBody.amenities = JSON.parse(req.body.amenities);
            } catch (error) {
                console.error('Error parsing amenities JSON:', error);
                processedBody.amenities = []; // Default to empty array if parsing fails
            }
        }

        // Handle unavailableDates - parse JSON string back to array
        if (req.body.unavailableDates && typeof req.body.unavailableDates === 'string') {
            try {
                processedBody.unavailableDates = JSON.parse(req.body.unavailableDates);
            } catch (error) {
                console.error('Error parsing unavailableDates JSON:', error);
                processedBody.unavailableDates = []; // Default to empty array if parsing fails
            }
        }

        // Handle allowedTimeSlots - parse JSON string back to array
        if (req.body.allowedTimeSlots && typeof req.body.allowedTimeSlots === 'string') {
            try {
                processedBody.allowedTimeSlots = JSON.parse(req.body.allowedTimeSlots);
            } catch (error) {
                console.error('Error parsing allowedTimeSlots JSON:', error);
                processedBody.allowedTimeSlots = []; // Default to empty array if parsing fails
            }
        }

        // Handle pricing - parse JSON string back to object
        if (req.body.pricing && typeof req.body.pricing === 'string') {
            try {
                processedBody.pricing = JSON.parse(req.body.pricing);
            } catch (error) {
                console.error('Error parsing pricing JSON:', error);
                processedBody.pricing = {}; // Default to empty object if parsing fails
            }
        }

        // Handle policies - parse JSON string back to object
        if (req.body.policies && typeof req.body.policies === 'string') {
            try {
                processedBody.policies = JSON.parse(req.body.policies);
            } catch (error) {
                console.error('Error parsing policies JSON:', error);
                processedBody.policies = {}; // Default to empty object if parsing fails
            }
        }

        // Handle location - parse JSON string back to object
        if (req.body.location && typeof req.body.location === 'string') {
            try {
                processedBody.location = JSON.parse(req.body.location);
            } catch (error) {
                console.error('Error parsing location JSON:', error);
                processedBody.location = {}; // Default to empty object if parsing fails
            }
        }

        // Handle bookingRules - parse JSON string back to object
        if (req.body.bookingRules && typeof req.body.bookingRules === 'string') {
            try {
                processedBody.bookingRules = JSON.parse(req.body.bookingRules);
            } catch (error) {
                console.error('Error parsing bookingRules JSON:', error);
                processedBody.bookingRules = {}; // Default to empty object if parsing fails
            }
        }

        console.log('Processed body:', processedBody); // Debug log

        // Parse and validate request body
        const validatedData = createPropertySchema.parse(processedBody);
        const {
            name,
            description,
            landmark,
            address,
            city,
            state,
            pincode,
            googleMapLink,
            totalArea,
            type,
            floorSize,
            totalFloor,
            cost,
            amenities,
            isSaturdayOpened,
            isSundayOpened,
            seatingCapacity,
            totalCostPerSeat,
            isPriceNegotiable,
            unavailableDates,
            furnishingLevel,
            propertyStatus,
            verificationStatus,
            lastInspectionDate,
            adminNote
        } = validatedData;

        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        console.log("Received files:", files);

        // Validate user
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            return next(createHttpError(401, "Invalid or expired session"));
        }

        if (!user.isEmailVerify) {
            return next(createHttpError(401, "User email is not verified"));
        }

        // only user role = propertyOwener is allowed
        if (user.role !== "propertyOwener") {
            return next(createHttpError(401, "You are not allowed for this request"));
        }

        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            // Update session activity (this may extend the session and generate new refresh token)
            const updateResult = user.updateSessionActivity(sessionId);

            // Generate new access token
            newAccessToken = user.generateAccessToken(sessionId);

            // If session was extended, we get a new refresh token
            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            // Save user with updated session
            await user.save({ validateBeforeSave: false });
        }

        // Check if property images are provided
        if (!files || !files.propertyImage || files.propertyImage.length === 0) {
            return next(createHttpError(400, "At least one property image is required"));
        }

        const propertyImages = files.propertyImage;

        // Validate number of images (max 5)
        if (propertyImages.length > 5) {
            return next(createHttpError(400, "Maximum 5 images are allowed"));
        }

        // Get file paths and add to deletion tracking
        const imagePaths: string[] = [];
        for (const file of propertyImages) {
            const path = getFilePath(file);
            if (path) {
                imagePaths.push(path);
                filesToDelete.push(path);
            }
        }

        console.log("Image paths:", imagePaths);

        // Check if all files exist
        const fileChecks = await Promise.all(
            imagePaths.map(async (path, index) => ({
                path,
                exists: await checkFileExists(path),
                index
            }))
        );

        const missingFiles = fileChecks.filter(check => !check.exists);
        if (missingFiles.length > 0) {
            return next(createHttpError(400, `Files not found: ${missingFiles.map(f => `image ${f.index + 1}`).join(', ')}`));
        }

        // Upload images to Cloudinary
        const uploadPromises = imagePaths.map((filePath, index) =>
            uploadImageToCloudinary(filePath, propertyImages[index]?.filename || `property_image_${Date.now()}_${index}`)
        );

        let uploadResults: { url: string; public_id: string }[] = [];

        try {
            console.log("Uploading images to Cloudinary...");
            uploadResults = await Promise.all(uploadPromises);
            console.log("Upload results:", uploadResults);
        } catch (uploadError) {
            console.error("Error uploading images:", uploadError);
            return next(createHttpError(500, "Failed to upload images to Cloudinary"));
        }

        // Process pricing data
        const pricingData = processedBody.pricing || {};

        // Validate that at least one pricing option is provided
        if (!pricingData.hourlyRate && !pricingData.dailyRate &&
            !pricingData.weeklyRate && !pricingData.monthlyRate) {
            return next(createHttpError(400, "At least one pricing option (hourly, daily, weekly, or monthly) is required"));
        }

        // Process time slots data
        const allowedTimeSlots = processedBody.allowedTimeSlots || [];

        // Validate time slots if provided
        if (allowedTimeSlots.length > 0) {
            const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

            for (const slot of allowedTimeSlots) {
                if (!validDays.includes(slot.day?.toLowerCase())) {
                    return next(createHttpError(400, `Invalid day: ${slot.day}. Must be one of: ${validDays.join(', ')}`));
                }
                if (!timeRegex.test(slot.startTime)) {
                    return next(createHttpError(400, `Invalid start time format: ${slot.startTime}. Use HH:MM format`));
                }
                if (!timeRegex.test(slot.endTime)) {
                    return next(createHttpError(400, `Invalid end time format: ${slot.endTime}. Use HH:MM format`));
                }
                if (slot.startTime >= slot.endTime) {
                    return next(createHttpError(400, `Start time must be before end time for ${slot.day}`));
                }
            }
        }

        // Process booking rules
        const bookingRules = {
            minBookingHours: processedBody.bookingRules?.minBookingHours || 1,
            maxBookingHours: processedBody.bookingRules?.maxBookingHours || 24,
            bufferHours: processedBody.bookingRules?.bufferHours || 0.5,
            allowedTimeSlots: allowedTimeSlots,
            advanceBookingDays: processedBody.bookingRules?.advanceBookingDays || 30,
            checkoutGracePeriod: processedBody.bookingRules?.checkoutGracePeriod || 15
        };

        // Process policies
        const policies = {
            guestPolicy: processedBody.policies?.guestPolicy || "with_permission",
            eventHostingAllowed: processedBody.policies?.eventHostingAllowed || false,
            smokingPolicy: processedBody.policies?.smokingPolicy || "not_allowed",
            petPolicy: processedBody.policies?.petPolicy || "not_allowed",
            foodAndBeveragePolicy: processedBody.policies?.foodAndBeveragePolicy || "outside_food_not_allowed"
        };

        // Process location data
        const location = {
            nearestMetroStation: processedBody.location?.nearestMetroStation || "",
            distanceFromMetro: processedBody.location?.distanceFromMetro || 0,
            nearestBusStop: processedBody.location?.nearestBusStop || "",
            distanceFromBusStop: processedBody.location?.distanceFromBusStop || 0,
            nearestRailwayStation: processedBody.location?.nearestRailwayStation || "",
            distanceFromRailway: processedBody.location?.distanceFromRailway || 0
        };

        // Create property in database
        const newProperty = new Property({
            ownerId: _id, // Use authenticated user's ID
            name,
            description,
            propertyImages: uploadResults.map(result => result.url), // Store Cloudinary URLs
            landmark,
            address,
            city,
            state,
            pincode,
            googleMapLink,
            totalArea: totalArea ? Number(totalArea) : undefined,
            type,
            floorSize: Number(floorSize),
            totalFloor: Number(totalFloor),
            cost: Number(cost),
            amenities,
            isSaturdayOpened: Boolean(isSaturdayOpened),
            isSundayOpened: Boolean(isSundayOpened),
            seatingCapacity: Number(seatingCapacity),
            totalCostPerSeat: Number(totalCostPerSeat),
            isPriceNegotiable: Boolean(isPriceNegotiable),
            unavailableDates: unavailableDates || [],
            furnishingLevel,
            propertyStatus,
            verificationStatus,
            lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : undefined,
            adminNote,
            // Add the new structured data
            pricing: pricingData,
            policies: policies,
            location: location,
            bookingRules: bookingRules
        });

        const savedProperty = await newProperty.save();

        // Clean up local files after successful upload
        await Promise.all(filesToDelete.map(safeDeleteFile));

        // Update session activity
        user.updateSessionActivity(sessionId);
        await user.save({ validateBeforeSave: false });

        res.status(201).json({
            success: true,
            message: "Property created successfully",
            data: {
                propertyId: savedProperty._id,
                name: savedProperty.name,
                propertyImages: savedProperty.propertyImages,
                verificationStatus: savedProperty.verificationStatus,
                propertyStatus: savedProperty.propertyStatus,
                pricing: savedProperty.pricing,
                allowedTimeSlots: savedProperty.bookingRules.allowedTimeSlots,
                policies: savedProperty.policies,
                location: savedProperty.location,
                bookingRules: savedProperty.bookingRules
            },
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            refreshToken: isAccessTokenExp ? newRefreshToken : null
        });

    } catch (error) {
        console.error("Create property error:", error);

        // Clean up uploaded files in case of error
        await Promise.all(filesToDelete.map(safeDeleteFile));

        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid property data", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        next(createHttpError(500, "Internal server error while creating property"));
    }
};

// get all property of property owner

const allPropertyOfOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Validate user
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            return next(createHttpError(401, "Invalid or expired session"));
        }

        if (!user.isEmailVerify) {
            return next(createHttpError(401, "User email is not verified"));
        }

        // only user role = propertyOwener is allowed
        if (user.role !== "propertyOwener") {
            return next(createHttpError(401, "You are not allowed for this request"));
        }

        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            // Update session activity (this may extend the session and generate new refresh token)
            const updateResult = user.updateSessionActivity(sessionId);

            // Generate new access token
            newAccessToken = user.generateAccessToken(sessionId);

            // If session was extended, we get a new refresh token
            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            // Save user with updated session
            await user.save({ validateBeforeSave: false });
            console.log(" user id", user._id);
            
            //  find all owner property
            const allProperties = await Property.find({ ownerId: user._id }).sort({ createdAt: -1 });
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties
                })
            }
        }
    } catch (error) {
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}

// Get property by ID
const getPropertyById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { propertyId } = req.params;

        if (!propertyId) {
            return next(createHttpError(400, "Property ID is required"));
        }

        const property = await Property.findById(propertyId)
            .populate('ownerId', 'name email phoneNumber')
            .exec();

        if (!property) {
            return next(createHttpError(404, "Property not found"));
        }

        res.status(200).json({
            success: true,
            data: property
        });

    } catch (error) {
        console.error("Get property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
};

// Get all properties for authenticated user
const getUserProperties = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;

        // Validate user and session
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        if (!user.isSessionValid(sessionId)) {
            return next(createHttpError(401, "Invalid or expired session"));
        }
        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            // Update session activity (this may extend the session and generate new refresh token)
            const updateResult = user.updateSessionActivity(sessionId);

            // Generate new access token
            newAccessToken = user.generateAccessToken(sessionId);

            // If session was extended, we get a new refresh token
            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            // Save user with updated session
            await user.save({ validateBeforeSave: false });
        }

        // Get pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Get filter parameters
        const { status, verificationStatus, type } = req.query;

        const filter: any = { ownerId: _id };
        if (status) filter.propertyStatus = status;
        if (verificationStatus) filter.verificationStatus = verificationStatus;
        if (type) filter.type = type;

        // Get properties with pagination
        const properties = await Property.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProperties = await Property.countDocuments(filter);
        const totalPages = Math.ceil(totalProperties / limit);

        // Update session activity
        user.updateSessionActivity(sessionId);
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            data: {
                properties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            },
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            refreshToken: isAccessTokenExp ? newRefreshToken : null
        });

    } catch (error) {
        console.error("Get user properties error:", error);
        next(createHttpError(500, "Internal server error while fetching properties"));
    }
};

// Get all properties for admin role (admin can see all properties)
const getAllPropertiesForAdminRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;

        // Validate user and session
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        if (!user.isSessionValid(sessionId)) {
            return next(createHttpError(401, "Invalid or expired session"));
        }

        // Check if user is admin
        if (user.role !== "admin") {
            return next(createHttpError(403, "Access denied. Admin role required"));
        }
        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            // Update session activity (this may extend the session and generate new refresh token)
            const updateResult = user.updateSessionActivity(sessionId);

            // Generate new access token
            newAccessToken = user.generateAccessToken(sessionId);

            // If session was extended, we get a new refresh token
            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            // Save user with updated session
            await user.save({ validateBeforeSave: false });
        }

        // Get pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Get filter parameters
        const { status, verificationStatus, type, city, state } = req.query;

        const filter: any = {};
        if (status) filter.propertyStatus = status;
        if (verificationStatus) filter.verificationStatus = verificationStatus;
        if (type) filter.type = type;
        if (city) filter.city = new RegExp(city as string, 'i');
        if (state) filter.state = new RegExp(state as string, 'i');

        // Get properties with pagination and populate owner details
        const properties = await Property.find(filter)
            .populate('ownerId', 'name email phoneNumber role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProperties = await Property.countDocuments(filter);
        const totalPages = Math.ceil(totalProperties / limit);

        // Update session activity
        user.updateSessionActivity(sessionId);
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            data: {
                properties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    status: status || null,
                    verificationStatus: verificationStatus || null,
                    type: type || null,
                    city: city || null,
                    state: state || null
                },
                isAccessTokenExp,
                accessToken: isAccessTokenExp ? newAccessToken : null,
                refreshToken: isAccessTokenExp ? newRefreshToken : null
            }
        });

    } catch (error) {
        console.error("Get admin properties error:", error);
        next(createHttpError(500, "Internal server error while fetching properties"));
    }
};

// Get all active and verified properties (public endpoint)
const getAllPropertyForActiveAndVerified = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Get filter parameters for public search
        const { type, city, state, minCost, maxCost, amenities, seatingCapacity } = req.query;

        const filter: any = {
            propertyStatus: "active",
            verificationStatus: "verified"
        };

        if (type) filter.type = type;
        if (city) filter.city = new RegExp(city as string, 'i');
        if (state) filter.state = new RegExp(state as string, 'i');

        // Price range filter
        if (minCost || maxCost) {
            filter.cost = {};
            if (minCost) filter.cost.$gte = Number(minCost);
            if (maxCost) filter.cost.$lte = Number(maxCost);
        }

        // Seating capacity filter
        if (seatingCapacity) {
            filter.seatingCapacity = { $gte: Number(seatingCapacity) };
        }

        // Amenities filter - check if all specified amenities exist
        if (amenities) {
            const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
            filter.amenities = { $all: amenitiesArray };
        }

        // Get properties with pagination and populate owner basic details
        const properties = await Property.find(filter)
            .populate('ownerId', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-adminNote -lastInspectionDate -unavailableDates') // Hide sensitive admin fields
            .exec();

        const totalProperties = await Property.countDocuments(filter);
        const totalPages = Math.ceil(totalProperties / limit);

        res.status(200).json({
            success: true,
            data: {
                properties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    type: type || null,
                    city: city || null,
                    state: state || null,
                    minCost: minCost || null,
                    maxCost: maxCost || null,
                    amenities: amenities || null,
                    seatingCapacity: seatingCapacity || null
                }
            }
        });

    } catch (error) {
        console.error("Get public properties error:", error);
        next(createHttpError(500, "Internal server error while fetching properties"));
    }
};

export {
    createProperty,
    getPropertyById,
    getUserProperties,
    getAllPropertiesForAdminRole,
    getAllPropertyForActiveAndVerified,
    allPropertyOfOwner
};