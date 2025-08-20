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
        // Parse and validate request body
        const validatedData = createPropertySchema.parse(req.body);
        const {
            address,
            amenities,
            city,
            description,
            location,
            name,
            ownerId,
            pincode,
            propertyStatus,
            state,
            totalSpaces,
            verificationStatus,
            adminNote,
            googleMapLink,
            lastInspectionDate,
            totalArea,
            type
        } = validatedData;

        const _req = req as AuthRequest;
        const { _id, sessionId } = _req;
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

        // Create property in database
        const newProperty = new Property({
            ownerId: _id, // Use authenticated user's ID instead of ownerId from body
            name,
            description,
            propertyImages: uploadResults.map(result => result.url), // Store Cloudinary URLs
            landmark: location, // Map location to landmark
            address,
            city,
            state,
            pincode,
            googleMapLink,
            totalArea: totalArea ? Number(totalArea) : undefined,
            type,
            totalSpaces,
            amenities,
            propertyStatus,
            verificationStatus,
            lastInspectionDate,
            adminNote
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
                createdAt: savedProperty.createdAt
            }
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
        const { _id, sessionId } = _req;

        // Validate user and session
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        if (!user.isSessionValid(sessionId)) {
            return next(createHttpError(401, "Invalid or expired session"));
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
            }
        });

    } catch (error) {
        console.error("Get user properties error:", error);
        next(createHttpError(500, "Internal server error while fetching properties"));
    }
};

export { 
    createProperty, 
    getPropertyById, 
    getUserProperties 
};