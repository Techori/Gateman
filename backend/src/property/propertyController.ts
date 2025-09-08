import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z, ZodError } from "zod";
import path from "node:path";
import fs from "node:fs";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { advancedFilterSchema, createPropertySchema, distanceFilterSchema, pageAndLimitCityAndTypeSchema, pageAndLimitCitySchema, pageAndLimitSchema, pageAndLimitTypeSchema, priceRangeSchema, propertyStausSchema, propertyStausSchemawithType } from "./propertyZodSchema.js";
import { Property } from "./propertyModel.js";
import { User } from "../user/userModel.js";
import cloudinary from "../config/cloudinary.js";




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
// propertyOwner
// get all property of property owner
const createProperty = async (req: Request, res: Response, next: NextFunction) => {
    const filesToDelete: string[] = []; // Track files to delete

    try {

        const processedBody = { ...req.body };

        // Handle amenities - parse JSON string back to array
        if (req.body.amenities && typeof req.body.amenities === 'string') {
            try {
                processedBody.amenities = JSON.parse(req.body.amenities);
            } catch (error) {
                console.error('Error parsing amenities JSON:', error);
                processedBody.amenities = [];
            }
        }

        // Handle unavailableDates - parse JSON string back to array
        if (req.body.unavailableDates && typeof req.body.unavailableDates === 'string') {
            try {
                processedBody.unavailableDates = JSON.parse(req.body.unavailableDates);
            } catch (error) {
                console.error('Error parsing unavailableDates JSON:', error);
                processedBody.unavailableDates = [];
            }
        }

        // Handle pricing - parse JSON string back to object
        if (req.body.pricing && typeof req.body.pricing === 'string') {
            try {
                processedBody.pricing = JSON.parse(req.body.pricing);
            } catch (error) {
                console.error('Error parsing pricing JSON:', error);
                processedBody.pricing = {};
            }
        }

        // Handle policies - parse JSON string back to object
        if (req.body.policies && typeof req.body.policies === 'string') {
            try {
                processedBody.policies = JSON.parse(req.body.policies);
            } catch (error) {
                console.error('Error parsing policies JSON:', error);
                processedBody.policies = {};
            }
        }

        // Handle location - parse JSON string back to object
        if (req.body.location && typeof req.body.location === 'string') {
            try {
                processedBody.location = JSON.parse(req.body.location);
            } catch (error) {
                console.error('Error parsing location JSON:', error);
                processedBody.location = {};
            }
        }

        // Handle bookingRules - parse JSON string back to object
        if (req.body.bookingRules && typeof req.body.bookingRules === 'string') {
            try {
                processedBody.bookingRules = JSON.parse(req.body.bookingRules);
            } catch (error) {
                console.error('Error parsing bookingRules JSON:', error);
                processedBody.bookingRules = {};
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
            adminNote,
            // Extract the nested objects with different names to avoid conflicts
            pricing: validatedPricing,
            policies: validatedPolicies,
            location: validatedLocation,
            bookingRules: validatedBookingRules
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
        const pricingData = validatedPricing || {};

        // Validate that at least one pricing option is provided
        if (!pricingData.hourlyRate && !pricingData.dailyRate &&
            !pricingData.weeklyRate && !pricingData.monthlyRate) {
            return next(createHttpError(400, "At least one pricing option (hourly, daily, weekly, or monthly) is required"));
        }

        // Process time slots data
        const allowedTimeSlots = validatedBookingRules?.allowedTimeSlots || [];

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

        // Process booking rules - use validated data with fallbacks
        const finalBookingRules = {
            minBookingHours: validatedBookingRules?.minBookingHours || 1,
            maxBookingHours: validatedBookingRules?.maxBookingHours || 24,
            bufferHours: validatedBookingRules?.bufferHours || 0.5,
            allowedTimeSlots: allowedTimeSlots,
            checkoutGracePeriod: validatedBookingRules?.checkoutGracePeriod || 15
        };

        // Process policies - use validated data with fallbacks
        const finalPolicies = {
            guestPolicy: validatedPolicies?.guestPolicy || "with_permission",
            eventHostingAllowed: validatedPolicies?.eventHostingAllowed || false,
            smokingPolicy: validatedPolicies?.smokingPolicy || "not_allowed",
            petPolicy: validatedPolicies?.petPolicy || "not_allowed",
            foodAndBeveragePolicy: validatedPolicies?.foodAndBeveragePolicy || "outside_food_not_allowed"
        };

        // Process location data - use validated data with fallbacks
        const finalLocation = {
            nearestMetroStation: validatedLocation?.nearestMetroStation || "",
            distanceFromMetro: validatedLocation?.distanceFromMetro || 0,
            nearestBusStop: validatedLocation?.nearestBusStop || "",
            distanceFromBusStop: validatedLocation?.distanceFromBusStop || 0,
            nearestRailwayStation: validatedLocation?.nearestRailwayStation || "",
            distanceFromRailway: validatedLocation?.distanceFromRailway || 0
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
            // Use the processed data
            pricing: pricingData,
            policies: finalPolicies,
            location: finalLocation,
            bookingRules: finalBookingRules
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
const allPropertyOfOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitSchema.parse(req.body)
        const { page, limit } = isValidLimitAndPage
        console.log("page, limit", page, limit);

        console.log("typeof page === number", typeof page === "number");
        console.log("typeof limit === number", typeof limit === "number");


        // page and limit must in number


        const skip = (page - 1) * limit;
        console.log("skip", skip);


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
            const allProperties = await Property.find({ ownerId: user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties,
                    isAccessTokenExp,
                    accessToken: isAccessTokenExp ? newAccessToken : null,
                    refreshToken: newRefreshToken ? newRefreshToken : null
                })
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}

const getAllPropertyOfOwnerByType = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitTypeSchema.parse(req.body)
        const { page, limit, type } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

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
            const allProperties = await Property.find({ ownerId: user._id, type }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties,
                    isAccessTokenExp,
                    accessToken: isAccessTokenExp ? newAccessToken : null,
                    refreshToken: newRefreshToken ? newRefreshToken : null
                })
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}
// get property by verfication status with pagination
const getOwnerPropertyByVerificationStatusWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Get pagination parameters
        const isValidLimitAndPage = propertyStausSchema.parse(req.body)
        const { verificationStatus, limit, page } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

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
            const allProperties = await Property.find({ ownerId: user._id, verificationStatus }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties,
                    isAccessTokenExp,
                    accessToken: isAccessTokenExp ? newAccessToken : null,
                    refreshToken: newRefreshToken ? newRefreshToken : null
                })
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}

// get property by city name with pagination
const getOwnerPropertyByCityNameWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitCitySchema.parse(req.body)
        const { city, limit, page } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

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
            const allProperties = await Property.find({ ownerId: user._id, city }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties,
                    isAccessTokenExp,
                    accessToken: isAccessTokenExp ? newAccessToken : null,
                    refreshToken: newRefreshToken ? newRefreshToken : null
                })
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}
// get property by city name and property Type with pagination
const getOwnerPropertyByCityAndTypeWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitCityAndTypeSchema.parse(req.body)
        const { city, limit, page, type } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

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
            const allProperties = await Property.find({ ownerId: user._id, city, type }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties,
                    isAccessTokenExp,
                    accessToken: isAccessTokenExp ? newAccessToken : null,
                    refreshToken: newRefreshToken ? newRefreshToken : null
                })
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}
// get property by verfication status and type with pagination
const getOwnerPropertyByVerificationStatusAndTypeWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Get pagination parameters
        const isValidLimitAndPage = propertyStausSchemawithType.parse(req.body)
        const { verificationStatus, limit, page, type } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

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
            const allProperties = await Property.find({ ownerId: user._id, verificationStatus, type }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
            if (allProperties) {
                res.status(200).json({
                    success: true,
                    message: "Fetch all owner property",
                    allProperties,
                    isAccessTokenExp,
                    accessToken: isAccessTokenExp ? newAccessToken : null,
                    refreshToken: newRefreshToken ? newRefreshToken : null
                })
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}

// find all verified properties with pagination with particular city  no user login is required

// get all verified property with pagination no user login is required  
const allVerifiedPropertyWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {

        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitSchema.parse(req.body)
        const { page, limit } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

        const allProperties = await Property.find({ verificationStatus: "verified" }).skip(skip).limit(limit).exec();

        if (allProperties) {
            res.status(200).json({
                success: true,
                message: "Fetch all owner property",
                allProperties,

            })
        }

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}

// get all verified property (property type is required) with pagination no user login is required 
const allVerifiedPropertyWithPaginationWithType = async (req: Request, res: Response, next: NextFunction) => {
    try {

        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitTypeSchema.parse(req.body)
        const { page, limit, type } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

        const allProperties = await Property.find({ verificationStatus: "verified", type }).skip(skip).limit(limit).exec();

        if (allProperties) {
            res.status(200).json({
                success: true,
                message: "Fetch all owner property",
                allProperties,

            })
        }

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}
// find all verified properties with pagination with particular city (city name is required) no user login is required
const allVerifiedPropertyWithCityWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {

        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitCitySchema.parse(req.body)
        const { page, limit, city } = isValidLimitAndPage

        // page and limit must in number

        const skip = (page - 1) * limit;

        const allProperties = await Property.find({ verificationStatus: "verified", city }).skip(skip).limit(limit).exec();

        if (allProperties) {
            res.status(200).json({
                success: true,
                message: "Fetch all owner property",
                allProperties,

            })
        }

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
        console.error("Get all property error:", error);
        next(createHttpError(500, "Internal server error while fetching property"));
    }
}
// find all verified properties with pagination with particular city and property Type  no user login is required
const allVerifiedPropertyWithCityAndTypeWithPagination = async (req: Request, res: Response, next: NextFunction) => {
    try {

        // Get pagination parameters
        const isValidLimitAndPage = pageAndLimitCityAndTypeSchema.parse(req.body)
        const { page, limit, city, type } = isValidLimitAndPage

        // page and limit must in number and 12

        const skip = (page - 1) * limit;

        const allProperties = await Property.find({ verificationStatus: "verified", city, type }).skip(skip).limit(limit).exec();

        if (allProperties) {
            res.status(200).json({
                success: true,
                message: "Fetch all owner property",
                allProperties,

            })
        }

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid req.body", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }
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

//  controller for authenticated property owners to filter their properties by price range
const getOwnerPropertiesByPriceRange = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;

        // Validate request body
        const validatedData = priceRangeSchema.parse(req.body);
        const { lowestPrice, highestPrice, page, limit } = validatedData; // type city added

        const skip = (page - 1) * limit;

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

        // Only property owners are allowed
        if (user.role !== "propertyOwener") {
            return next(createHttpError(401, "You are not allowed for this request"));
        }

        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            const updateResult = user.updateSessionActivity(sessionId);
            newAccessToken = user.generateAccessToken(sessionId);

            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            await user.save({ validateBeforeSave: false });
        }

        // Build query for owner's properties within price range
        const query = {
            ownerId: user._id,
            $or: [
                {
                    "pricing.hourlyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    "pricing.dailyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    "pricing.weeklyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    "pricing.monthlyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    cost: {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                }
            ]
        };

        const allProperties = await Property.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProperties = await Property.countDocuments(query);
        const totalPages = Math.ceil(totalProperties / limit);

        res.status(200).json({
            success: true,
            message: "Owner properties fetched successfully by price range",
            data: {
                properties: allProperties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    lowestPrice,
                    highestPrice
                }
            },
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            refreshToken: newRefreshToken ? newRefreshToken : null
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid request data", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        console.error("Get owner properties by price range error:", error);
        next(createHttpError(500, "Internal server error while fetching owner properties by price range"));
    }
};

//  controller getAllVerifiedPropertiesByPriceRange
const getAllVerifiedPropertiesByPriceRange = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate request body
        const validatedData = priceRangeSchema.parse(req.body);
        const { lowestPrice, highestPrice, page, limit } = validatedData;

        const skip = (page - 1) * limit;

        // Build the query for verified properties with price range
        const query = {
            verificationStatus: "verified",
            propertyStatus: "active",
            $or: [
                // Check if any pricing option falls within the range
                {
                    "pricing.hourlyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    "pricing.dailyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    "pricing.weeklyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },
                {
                    "pricing.monthlyRate": {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                },

                {
                    cost: {
                        $gte: lowestPrice,
                        $lte: highestPrice
                    }
                }
            ]
        };

        // Execute the query with pagination
        const allProperties = await Property.find(query)
            .populate('ownerId', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        // Get total count for pagination
        const totalProperties = await Property.countDocuments(query);
        const totalPages = Math.ceil(totalProperties / limit);

        res.status(200).json({
            success: true,
            message: "Properties fetched successfully by price range",
            data: {
                properties: allProperties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    lowestPrice,
                    highestPrice
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid request data", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        console.error("Get properties by price range error:", error);
        next(createHttpError(500, "Internal server error while fetching properties by price range"));
    }
};
// Controller for property owners - get their properties by distance from transportation
const getOwnerPropertiesByDistance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;

        // Validate request body
        const validatedData = distanceFilterSchema.parse(req.body);
        const { metroDistance, busStopDistance, railwayDistance, page, limit, city, type } = validatedData;

        const skip = (page - 1) * limit;

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

        // Only property owners are allowed
        if (user.role !== "propertyOwener") {
            return next(createHttpError(401, "You are not allowed for this request"));
        }

        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            const updateResult = user.updateSessionActivity(sessionId);
            newAccessToken = user.generateAccessToken(sessionId);

            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            await user.save({ validateBeforeSave: false });
        }

        // Build base query for owner's properties
        const baseQuery: any = {
            ownerId: user._id
        };

        // Add optional filters
        if (city) {
            baseQuery.city = new RegExp(city, 'i');
        }
        if (type) {
            baseQuery.type = type;
        }

        // Build distance conditions
        const distanceConditions = [];

        if (metroDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestMetroStation": { $exists: true, $ne: "" } },
                    { "location.distanceFromMetro": { $lte: metroDistance } }
                ]
            });
        }

        if (busStopDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestBusStop": { $exists: true, $ne: "" } },
                    { "location.distanceFromBusStop": { $lte: busStopDistance } }
                ]
            });
        }

        if (railwayDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestRailwayStation": { $exists: true, $ne: "" } },
                    { "location.distanceFromRailway": { $lte: railwayDistance } }
                ]
            });
        }

        // Combine base query with distance conditions
        const finalQuery = {
            ...baseQuery,
            $or: distanceConditions
        };

        console.log("Owner distance filter query:", JSON.stringify(finalQuery, null, 2));

        const allProperties = await Property.find(finalQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProperties = await Property.countDocuments(finalQuery);
        const totalPages = Math.ceil(totalProperties / limit);

        res.status(200).json({
            success: true,
            message: "Owner properties fetched successfully by distance from transportation",
            data: {
                properties: allProperties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    metroDistance: metroDistance || null,
                    busStopDistance: busStopDistance || null,
                    railwayDistance: railwayDistance || null,
                    city: city || null,
                    type: type || null
                }
            },
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            refreshToken: newRefreshToken ? newRefreshToken : null
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid request data", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        console.error("Get owner properties by distance error:", error);
        next(createHttpError(500, "Internal server error while fetching owner properties by distance"));
    }
};
// Controller for public access - get verified properties by distance from transportation
const getAllVerifiedPropertiesByDistance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate request body
        const validatedData = distanceFilterSchema.parse(req.body);
        const { metroDistance, busStopDistance, railwayDistance, page, limit, city, type } = validatedData; // lowestPrice, highestPrice added in accesding to price range praking is avaible or not?

        const skip = (page - 1) * limit;

        // Build base query for verified and active properties
        const baseQuery: any = {
            verificationStatus: "verified",
            propertyStatus: "active"
        };

        // Add optional filters
        if (city) {
            baseQuery.city = new RegExp(city, 'i');
        }
        if (type) {
            baseQuery.type = type;
        }

        // Build distance conditions using $or operator
        const distanceConditions = [];

        if (metroDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestMetroStation": { $exists: true, $ne: "" } },
                    { "location.distanceFromMetro": { $lte: metroDistance } }
                ]
            });
        }

        if (busStopDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestBusStop": { $exists: true, $ne: "" } },
                    { "location.distanceFromBusStop": { $lte: busStopDistance } }
                ]
            });
        }

        if (railwayDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestRailwayStation": { $exists: true, $ne: "" } },
                    { "location.distanceFromRailway": { $lte: railwayDistance } }
                ]
            });
        }

        // Combine base query with distance conditions
        const finalQuery = {
            ...baseQuery,
            $or: distanceConditions
        };

        console.log("Distance filter query:", JSON.stringify(finalQuery, null, 2));

        // Execute the query with pagination
        const allProperties = await Property.find(finalQuery)
            .populate('ownerId', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        // Get total count for pagination
        const totalProperties = await Property.countDocuments(finalQuery);
        const totalPages = Math.ceil(totalProperties / limit);

        res.status(200).json({
            success: true,
            message: "Properties fetched successfully by distance from transportation",
            data: {
                properties: allProperties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    metroDistance: metroDistance || null,
                    busStopDistance: busStopDistance || null,
                    railwayDistance: railwayDistance || null,
                    city: city || null,
                    type: type || null
                }
            }
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid request data", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        console.error("Get properties by distance error:", error);
        next(createHttpError(500, "Internal server error while fetching properties by distance"));
    }
};

/**
 * Controller for property owners - get their properties with advanced filtering and price sorting
 */
const getOwnerPropertiesWithAdvancedFilter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;

        // Validate request body
        const validatedData = advancedFilterSchema.parse(req.body);
        const {
            metroDistance,
            busStopDistance,
            railwayDistance,
            city,
            type,
            lowestPrice,
            highestPrice,
            hasParking,
            page,
            limit
        } = validatedData;

        const skip = (page - 1) * limit;

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

        // Only property owners are allowed
        if (user.role !== "propertyOwener") {
            return next(createHttpError(401, "You are not allowed for this request"));
        }

        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            const updateResult = user.updateSessionActivity(sessionId);
            newAccessToken = user.generateAccessToken(sessionId);

            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }

            await user.save({ validateBeforeSave: false });
        }

        // Build base query for owner's properties
        const baseQuery: any = {
            ownerId: user._id
        };

        // Add location filters
        if (city) {
            baseQuery.city = new RegExp(city, 'i');
        }
        if (type) {
            baseQuery.type = type;
        }

        // Add parking filter
        if (hasParking !== undefined) {
            if (hasParking) {
                baseQuery.amenities = { $in: [/parking/i, /car park/i, /vehicle/i] };
            } else {
                baseQuery.amenities = { $not: { $in: [/parking/i, /car park/i, /vehicle/i] } };
            }
        }

        // Build distance conditions
        const distanceConditions = [];

        if (metroDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestMetroStation": { $exists: true, $ne: "" } },
                    { "location.distanceFromMetro": { $lte: metroDistance } }
                ]
            });
        }

        if (busStopDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestBusStop": { $exists: true, $ne: "" } },
                    { "location.distanceFromBusStop": { $lte: busStopDistance } }
                ]
            });
        }

        if (railwayDistance !== undefined) {
            distanceConditions.push({
                $and: [
                    { "location.nearestRailwayStation": { $exists: true, $ne: "" } },
                    { "location.distanceFromRailway": { $lte: railwayDistance } }
                ]
            });
        }

        // Add distance conditions to query if any exist
        if (distanceConditions.length > 0) {
            baseQuery.$or = distanceConditions;
        }

        // Add price range conditions
        if (lowestPrice !== undefined || highestPrice !== undefined) {
            const priceConditions = [];

            const priceQuery: any = {};
            if (lowestPrice !== undefined) priceQuery.$gte = lowestPrice;
            if (highestPrice !== undefined) priceQuery.$lte = highestPrice;

            priceConditions.push(
                { "pricing.hourlyRate": priceQuery },
                { "pricing.dailyRate": priceQuery },
                { "pricing.weeklyRate": priceQuery },
                { "pricing.monthlyRate": priceQuery },
                { cost: priceQuery }
            );

            if (baseQuery.$or) {
                // Combine distance and price conditions
                baseQuery.$and = [
                    { $or: baseQuery.$or },
                    { $or: priceConditions }
                ];
                delete baseQuery.$or;
            } else {
                baseQuery.$or = priceConditions;
            }
        }

        console.log("Owner advanced filter query:", JSON.stringify(baseQuery, null, 2));

        // Execute query with sorting by price (ascending)
        const allProperties = await Property.find(baseQuery)
            .sort({
                cost: 1, // Primary sort by cost (ascending)
                "pricing.hourlyRate": 1, // Secondary sort by hourly rate
                createdAt: -1 // Tertiary sort by creation date
            })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProperties = await Property.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProperties / limit);

        res.status(200).json({
            success: true,
            message: "Owner properties fetched successfully with advanced filters (sorted by price)",
            data: {
                properties: allProperties,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProperties,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    metroDistance: metroDistance || null,
                    busStopDistance: busStopDistance || null,
                    railwayDistance: railwayDistance || null,
                    city: city || null,
                    type: type || null,
                    lowestPrice: lowestPrice || null,
                    highestPrice: highestPrice || null,
                    hasParking: hasParking || null
                }
            },
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            refreshToken: newRefreshToken ? newRefreshToken : null
        });

    } catch (error) {
        if (error instanceof ZodError) {
            return next(createHttpError(400, "Invalid request data", { cause: error }));
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        console.error("Get owner properties with advanced filter error:", error);
        next(createHttpError(500, "Internal server error while fetching owner properties"));
    }
};

export {
    createProperty,
    getPropertyById,
    getUserProperties,
    getAllPropertiesForAdminRole,
    getAllPropertyForActiveAndVerified,
    allPropertyOfOwner,
    getAllPropertyOfOwnerByType,
    allVerifiedPropertyWithPagination,
    allVerifiedPropertyWithPaginationWithType,
    allVerifiedPropertyWithCityWithPagination,
    allVerifiedPropertyWithCityAndTypeWithPagination,
    getOwnerPropertyByVerificationStatusAndTypeWithPagination,
    getOwnerPropertyByVerificationStatusWithPagination,
    getOwnerPropertyByCityNameWithPagination,
    getOwnerPropertyByCityAndTypeWithPagination,
    getOwnerPropertiesByPriceRange,
    getAllVerifiedPropertiesByPriceRange,
    getOwnerPropertiesByDistance,
    getAllVerifiedPropertiesByDistance,
    getOwnerPropertiesWithAdvancedFilter
};