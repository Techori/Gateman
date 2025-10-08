import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z, ZodError } from "zod";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import {
    changePasswordSchema,
    createEmployeeSchema,
    createUserSchema,
    forceLogoutSchema,
    forgotPasswordSendOtpSchema,
    loginUserSchema,
    pageSchema,
    resetPasswordWithOtpSchema,
} from "./userZodSchema.js";
import { Resend } from "resend";

import { config } from "../config/index.js";
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';
import { User } from "./userModel.js";
import mongoose from "mongoose";


// Helper function to extract public_id from Cloudinary URL
const extractPublicIdFromUrl = (url: string): string | null => {
    try {
        // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
        const urlParts = url.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        if (uploadIndex === -1) return null;

        // Get everything after 'upload/' and before the file extension
        const publicIdWithFormat = urlParts.slice(uploadIndex + 1).join('/');

        // Remove file extension and any transformations
        const lastSlashIndex = publicIdWithFormat.lastIndexOf('/');
        const fileName = lastSlashIndex === -1 ? publicIdWithFormat : publicIdWithFormat.substring(lastSlashIndex + 1);
        const publicId: string = fileName.split('.')[0] ?? ""; // Ensure publicId is always a string

        // If there were transformations, we need the full path
        return lastSlashIndex === -1 ? publicId : publicIdWithFormat.replace(/\.[^/.]+$/, "");
    } catch (error) {
        console.error('Error extracting public_id from URL:', error);
        return null;
    }
};

// Helper function to delete image from Cloudinary
const deleteImageFromCloudinary = async (publicId: string): Promise<boolean> => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log('Cloudinary deletion result:', result);
        return result.result === 'ok';
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        return false;
    }
};

// Helper function to upload profile image to Cloudinary
const uploadProfileImageToCloudinary = async (
    filePath: string,
    userId: string
): Promise<{ url: string; public_id: string }> => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: "UserProfiles",
            public_id: `user_profile_${userId}_${Date.now()}`,
            resource_type: "image",
            transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto:good" },
                { format: "auto" }
            ],
            overwrite: true
        });

        return {
            url: result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Failed to upload profile image to Cloudinary");
    }
};

// Helper function to extract device info
const getDeviceInfo = (req: Request) => {
    const userAgent = req.get("User-Agent") || "";
    const ipAddress = req.ip || req.connection.remoteAddress || "";

    let deviceType = "desktop";
    if (/mobile/i.test(userAgent)) {
        deviceType = "mobile";
    } else if (/tablet/i.test(userAgent)) {
        deviceType = "tablet";
    }

    return {
        userAgent,
        ipAddress,
        deviceType,
    };
};

const sendOtpEmail = async (toEmail: string, otp: number) => {
    try {
        const resend = new Resend(config.RESEND_API_KEY);
        const response = await resend.emails.send({
            from: config.EMAIL_FROM, // must be a verified sender in Resend
            to: toEmail,
            subject: "Your OTP Code",
            html: `<p>Your OTP code is: <b>${otp}</b></p>
             <p>This code will expire in 5 minutes.</p>`,
        });
        console.log("Email sent:", response);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};
const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validateUser = createUserSchema.parse(req.body);
        const { email, name, password, phoneNumber, role } = validateUser;
        console.log("email, name, password", email, name, password);
        // check user is already exist in db
        const checkUser = await User.findOne({
            email,
        }).select("-password ");
        if (checkUser) {
            const err = createHttpError(
                401,
                "User is already exist with this email id"
            );

            return next(err);
        }
        // register new user on db
        const newUser = await User.create({
            name,
            email,
            password,
            isEmailVerify: false,
            isLogin: false,
            refreshToken: "",
            phoneNumber,
            sessions: [],
            role,
            status: "active",
            otp: 0,
            otpExpiresAt: Date.now(),
        });
        if (newUser) {
            console.log("newUser", newUser);

            // Auto-create wallet for the new user
            try {
                const { createWallet } = await import("../wallet/walletController.js");
                await createWallet(newUser._id.toString());
                console.log("Wallet created for user:", newUser._id);
            } catch (walletError) {
                console.error("Error creating wallet for user:", walletError);
                // Don't fail user registration if wallet creation fails
            }

            res.status(201).json({
                success: true,
                message: "user is register successfully",
            });
        }
    } catch (error) {
        if (error instanceof ZodError) {
            const err = createHttpError(401, {
                message: {
                    type: "Validation zod error",
                    zodError: error.issues,
                },
            });
            next(err);
        } else {
            const err = createHttpError(
                500,
                "Internal server error while creating user"
            );

            next(err);
        }
    }
};



const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;

        // Validate request body
        const validateUser = createEmployeeSchema.parse(req.body);
        const { email, name, password, phoneNumber, role, propertyId } = validateUser;

        // Find the current user (property owner)
        const user = await User.findById(_id).select("-password");
        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Check if user has proper role to create employees
        if (user.role !== "propertyOwener") {
            const err = createHttpError(403, "You are not allowed to create employee");
            return next(err);
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            const err = createHttpError(401, "Invalid or expired session");
            return next(err);
        }

        // Check if employee already exists in database
        const isValidEmployee = await User.findOne({ email });
        if (isValidEmployee) {
            const err = createHttpError(409, `Employee is already registered with email ${email}`);
            return next(err);
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

        // Create new employee with employeeDetails
        const newEmployee = await User.create({
            name,
            email,
            password,
            isEmailVerify: false,
            isLogin: false,
            phoneNumber,
            sessions: [],
            role,
            status: "active",
            otp: 0,
            otpExpiresAt: Date.now(),
            employeeDetails: {
                propertyOwnerId: _id,
                propertyId: propertyId,
                assignedAt: new Date()
            }
        });

        if (newEmployee) {

            console.log("newEmployee created:", newEmployee._id);

            // Prepare response
            const responseData: any = {
                success: true,
                message: "Employee registered successfully",
                employee: {
                    id: newEmployee._id,
                    name: newEmployee.name,
                    email: newEmployee.email,
                    role: newEmployee.role,
                    phoneNumber: newEmployee.phoneNumber,
                    status: newEmployee.status,
                    createdAt: newEmployee.createdAt,
                    employeeDetails: {
                        propertyOwnerId: newEmployee.employeeDetails.propertyOwnerId,
                        propertyId: newEmployee.employeeDetails.propertyId,
                        assignedAt: newEmployee.employeeDetails.assignedAt
                    }
                }
            };

            // Include new tokens if access token was expired
            if (isAccessTokenExp && newAccessToken) {
                responseData.tokenUpdate = {
                    newAccessToken,
                    message: "Access token was refreshed"
                };

                if (newRefreshToken) {
                    responseData.tokenUpdate.newRefreshToken = newRefreshToken;
                    responseData.tokenUpdate.message += " and session was extended";
                }
            }

            res.status(201).json({
                success: true,
                message: "Employee registered successfully",
                employee: responseData.employee,
                isAccessTokenExp,
                accessToken: isAccessTokenExp ? newAccessToken : null,
                refreshToken: newRefreshToken ? newRefreshToken : null
            });
        }

    } catch (error) {
        if (error instanceof ZodError) {
            const err = createHttpError(400, {
                message: {
                    type: "Validation error",
                    zodError: error.issues,
                },
            });
            next(err);
        } else {
            console.error("Create Employee Error:", error);
            const err = createHttpError(
                500,
                "Internal server error while creating employee"
            );
            next(err);
        }
    }
};
// get all employee details for a property owner with limit and skip for pagination

const getAllEmployeesForPropertyOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const _req = req as AuthRequest;
        console.log("=== DEBUGGING USER MODEL ===");
        console.log("1. User model:", User);
        console.log("2. typeof User:", typeof User);
        console.log("3. User.find:", User.find);
        console.log("4. User.prototype:", Object.getOwnPropertyNames(User.prototype));
        console.log("5. mongoose.connection.readyState:", mongoose.connection.readyState);
        console.log("6. mongoose.models:", Object.keys(mongoose.models));

        // Try to get the model from mongoose directly
        const UserFromMongoose = mongoose.model("User");
        console.log("7. UserFromMongoose:", UserFromMongoose);
        console.log("8. UserFromMongoose === User:", UserFromMongoose === User);
        console.log("9. UserFromMongoose.find:", UserFromMongoose.find);
        console.log("10. UserFromMongoose.prototype:", Object.getOwnPropertyNames(UserFromMongoose.prototype));
        const { _id, sessionId, isAccessTokenExp } = _req;
        // Try the find operation with the mongoose model
        // Get pagination parameters from query params instead of body
        // Convert string query params to numbers with defaults
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        // Validate pagination parameters
        const isValidLimitAndPage = pageSchema.parse({ page, limit });
        const { limit: validatedLimit, page: validatedPage } = isValidLimitAndPage;

        // Calculate skip for pagination
        const skip = (validatedPage - 1) * validatedLimit;
        console.log("skip limit page", skip, limit, page);

        console.log("Attempting to find user by ID :", _id ,skip, validatedLimit, validatedPage);
        
        
        // // Find the current user (property owner)
        const user = await UserFromMongoose.findById(_id).select("-password -refreshToken -sessions -otp -otpExpiresAt");
        console.log("user found:", user);
        
        
        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Check if user has proper role to get employees
        if (user.role !== "propertyOwener") {
            const err = createHttpError(403, "You are not allowed to get all employees details");
            return next(err);
        }
        console.log("checking -2 #######################");
        // Validate session
        // if (!user.isSessionValid(sessionId)) {
        //     console.log("checking -4 #######################");
        //     const err = createHttpError(401, "Invalid or expired session");
        //     return next(err);
        // }
        console.log("checking -1 #######################");
        // Handle access token expiration and session update
        let newAccessToken = null;
        let newRefreshToken = null;
        
        if (isAccessTokenExp) {
            console.log("checking 100 #######################");
            // Update session activity (this may extend the session and generate new refresh token)
            // const updateResult = user.updateSessionActivity(sessionId);
            
            // Generate new access token
            newAccessToken = user.generateAccessToken(sessionId);
            console.log("newAccessToken #######################",newAccessToken);
            // If session was extended, we get a new refresh token
            // if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
            //     newRefreshToken = updateResult.newRefreshToken;
            // }
            
            // Save user with updated session
            // await user.save({ validateBeforeSave: false });
            
        }
        // const testResult = await UserFromMongoose.find({});
        console.log("checking 0 #######################");
        const employees = await User.find({
            "employeeDetails.propertyOwnerId": _id
        })
            .select("-password -refreshToken -sessions -otp -otpExpiresAt")
            .populate('employeeDetails.propertyId', 'name address') // Optional: populate property details
            .sort({ createdAt: -1 }); // Optional: sort by creation date, newest first
        // res.status(200).json({
        //     success: true,
        //     debug: {
        //         userModelExists: !!User,
        //         findMethodExists: !!User.find,
        //         dbState: mongoose.connection.readyState,
        //         modelCount: testResult.length
        //     },
        //     data: testResult,
        //     employees
        // });
        console.log("checking 1 #######################");
        const totalEmployees = await UserFromMongoose.countDocuments({
            "employeeDetails.propertyOwnerId": _id
        });
        console.log("checking #######################");
        

        const totalPages = Math.ceil(totalEmployees / validatedLimit);
        const hasNextPage = validatedPage < totalPages;
        const hasPrevPage = validatedPage > 1;
        
        return res.status(200).json({
            success: true,
            message: "Employees fetched successfully",
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            
            data: {
                employees: employees,
                pagination: {
                    currentPage: validatedPage,
                    totalPages: totalPages,
                    totalEmployees: totalEmployees,
                    limit: validatedLimit,
                    hasNextPage: hasNextPage,
                    hasPrevPage: hasPrevPage
                }
            }
        });
    } catch (error) {
        console.log("=== ERROR DETAILS ===");
        console.log("Error:", error);
        console.log("Error stack:", (error as Error).stack);

        const err = createHttpError(500, ` error: ${(error as Error).message}`);
        next(err);
    }
}

// const test = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         console.log("User model:", User); // Add this line
//         console.log("typeof User:", typeof User); 
//         console.log("User model:", User);
//         console.log("typeof User:", typeof User);
//         console.log("User.prototype:", User.prototype);
//         console.log("Database connection state:", mongoose.connection.readyState);

//         const _req = req as AuthRequest;
//         const { _id, sessionId, isAccessTokenExp } = _req;

//         // Check if mongoose is connected
//         if (mongoose.connection.readyState !== 1) {
//             return next(createHttpError(500, "Database not connected"));
//         }

//         const user = await User.findById(_id).select("-password -refreshToken -sessions");
//         if (!user) {
//             const err = createHttpError(404, "User not found");
//             return next(err);
//         }
//         // const _req = req as AuthRequest;
//         // const { _id, sessionId, isAccessTokenExp } = _req;
//         // const user = await User.findById(_id).select("-password -refreshToken -sessions");
//         if (!user) {
//             const err = createHttpError(404, "User not found");
//             return next(err);
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
//          if (!User) {
//             console.error("User model is undefined!");
//             return next(createHttpError(500, "User model not properly imported"));
//         }

//         const test = await User.find({})


//         if(test){
//             res.status(200).json({
//                 test
//             })
//         }


//     } catch (error) {
//         console.log("error ",error);

//         const err = createHttpError(
//                 500,
//                 "Internal server error while test in user"
//             );
//             next(err);
//     }
// }
// const getAllEmployeesForPropertyOwner = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const _req = req as AuthRequest;
//         console.log("=== DEBUGGING USER MODEL ===");
//         console.log("1. User model:", User);
//         console.log("2. typeof User:", typeof User);
//         console.log("3. User.find:", User.find);
//         console.log("4. User.prototype:", Object.getOwnPropertyNames(User.prototype));
//         console.log("5. mongoose.connection.readyState:", mongoose.connection.readyState);
//         console.log("6. mongoose.models:", Object.keys(mongoose.models));

//         // Try to get the model from mongoose directly
//         
//         
//         const { _id, sessionId, isAccessTokenExp } = _req;
//         // Try the find operation with the mongoose model
//         // Get pagination parameters from query params instead of body
//         // Convert string query params to numbers with defaults
//         const page = parseInt(req.query.page as string) || 1;
//         const limit = parseInt(req.query.limit as string) || 10;

//         // Validate pagination parameters
//         const isValidLimitAndPage = pageSchema.parse({ page, limit });
//         const { limit: validatedLimit, page: validatedPage } = isValidLimitAndPage;

//         // Calculate skip for pagination
//         const skip = (validatedPage - 1) * validatedLimit;
//         console.log("skip limit page", skip, limit, page);

//         console.log("Attempting to find user by ID :", _id ,skip, validatedLimit, validatedPage);
        
        
//         // // Find the current user (property owner)
//         const user = await User.findById(_id).select("-password -refreshToken -sessions -otp -otpExpiresAt");
//         console.log("user found:", user);
        
        
//         if (!user) {
//             const err = createHttpError(404, "User not found");
//             return next(err);
//         }

//         // Check if user has proper role to get employees
//         if (user.role !== "propertyOwener") {
//             const err = createHttpError(403, "You are not allowed to get all employees details");
//             return next(err);
//         }
//         console.log("checking -2 #######################");
//         // Validate session
//         // if (!user.isSessionValid(sessionId)) {
//         //     console.log("checking -4 #######################");
//         //     const err = createHttpError(401, "Invalid or expired session");
//         //     return next(err);
//         // }
//         console.log("checking -1 #######################");
//         // Handle access token expiration and session update
//         let newAccessToken = null;
//         let newRefreshToken = null;
        
//         if (isAccessTokenExp) {
//             console.log("checking 100 #######################");
//             // Update session activity (this may extend the session and generate new refresh token)
//             // const updateResult = user.updateSessionActivity(sessionId);
            
//             // Generate new access token
//             newAccessToken = user.generateAccessToken(sessionId);
//             console.log("newAccessToken #######################",newAccessToken);
//             // If session was extended, we get a new refresh token
//             // if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
//             //     newRefreshToken = updateResult.newRefreshToken;
//             // }
            
//             // Save user with updated session
//             // await user.save({ validateBeforeSave: false });
            
//         }
//         // const testResult = await User.find({});
//         console.log("checking 0 #######################");
//         const employees = await User.find({
//             "employeeDetails.propertyOwnerId": _id
//         })
//             .select("-password -refreshToken -sessions -otp -otpExpiresAt")
//             .populate('employeeDetails.propertyId', 'name address') // Optional: populate property details
//             .sort({ createdAt: -1 }); // Optional: sort by creation date, newest first
//         // res.status(200).json({
//         //     success: true,
//         //     debug: {
//         //         userModelExists: !!User,
//         //         findMethodExists: !!User.find,
//         //         dbState: mongoose.connection.readyState,
//         //         modelCount: testResult.length
//         //     },
//         //     data: testResult,
//         //     employees
//         // });
//         console.log("checking 1 #######################");
//         const totalEmployees = await User.countDocuments({
//             "employeeDetails.propertyOwnerId": _id
//         });
//         console.log("checking #######################");
        

//         const totalPages = Math.ceil(totalEmployees / validatedLimit);
//         const hasNextPage = validatedPage < totalPages;
//         const hasPrevPage = validatedPage > 1;
        
//         return res.status(200).json({
//             success: true,
//             message: "Employees fetched successfully",
//             isAccessTokenExp,
//             accessToken: isAccessTokenExp ? newAccessToken : null,
            
//             data: {
//                 employees: employees,
//                 pagination: {
//                     currentPage: validatedPage,
//                     totalPages: totalPages,
//                     totalEmployees: totalEmployees,
//                     limit: validatedLimit,
//                     hasNextPage: hasNextPage,
//                     hasPrevPage: hasPrevPage
//                 }
//             }
//         });
//     } catch (error) {
//         console.log("=== ERROR DETAILS ===");
//         console.log("Error:", error);
//         console.log("Error stack:", (error as Error).stack);

//         const err = createHttpError(500, ` error: ${(error as Error).message}`);
//         next(err);
//     }
// }
const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isValidUser = loginUserSchema.parse(req.body);
        const { email, password } = isValidUser;

        const user = await User.findOne({ email });

        if (!user) {
            const err = createHttpError(401, "User does not exist");
            return next(err);
        }

        // Check password
        const isPasswordCorrect = await user.isPasswordCorrect(password);
        if (!isPasswordCorrect) {
            const err = createHttpError(400, "Invalid password");
            return next(err);
        }

        // Clean expired sessions first
        const cleanedCount = user.cleanExpiredSessions();
        if (cleanedCount > 0) {
            console.log(
                `Cleaned ${cleanedCount} expired sessions for user ${user._id}`
            );
        }

        // Check if user has reached maximum sessions (5)
        const currentSessions = user.getActiveSessions();
        if (currentSessions.length >= 5) {
            return res.status(429).json({
                success: false,
                message:
                    "Maximum number of active sessions reached (5). Please logout from another device.",
                activeSessions: currentSessions.length,
                maxSessions: 5,
            });
        }

        // Get device information
        const deviceInfo = getDeviceInfo(req);

        // Create new session
        const { sessionId, refreshToken } = user.createSession(deviceInfo);

        // Generate access token for this session
        const accessToken = user.generateAccessToken(sessionId);

        await user.save({ validateBeforeSave: false });

        // Get session details for response
        const session = user.findSession(sessionId);

        if (session) {
            res.status(200).json({
                success: true,
                message: "User logged in successfully",
                data: {
                    accessToken,
                    refreshToken,
                    sessionId,
                    sessionExpiresAt: session.expiresAt,
                    activeSessions: user.getSessionCount(),
                    maxSessions: 5,
                    userDetails: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        isEmailVerified: user.isEmailVerify,
                        phoneNumber: user.phoneNumber,
                        userProfileUrl: user.userProfileUrl || "",
                    },
                    deviceInfo: session.deviceInfo,
                },
            });
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const err = createHttpError(401, {
                message: {
                    type: "Validation zod error",
                    zodError: error.issues,
                },
            });
            next(err);
        } else {
            const err = createHttpError(
                500,
                "Internal server error while logging in user"
            );
            next(err);
        }
    }
};

const logoutUserBySessionId = async (req: Request, res: Response, next: NextFunction) => {
    const { id, sessionId } = req.body
    if (!id) {
        const err = createHttpError(
            400,
            "Id is required"
        );
        next(err);
    }
    if (!sessionId) {
        const err = createHttpError(
            400,
            "sessionId is required"
        );
        next(err);
    }
    try {
        const user = await User.findById(id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        const isvalidSession = user.isSessionValid(sessionId)
        if (!isvalidSession) {
            const err = createHttpError(404, "sessionId not found");
            return next(err);
        }
        // Remove specific session
        const sessionRemoved = user.removeSession(sessionId);

        if (!sessionRemoved) {
            const err = createHttpError(404, "Session not found");
            return next(err);
        }

        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "User logged out successfully from this device",
            remainingSessions: user.getSessionCount(),
        });
    } catch (error) {

    }
}

const logoutUser = async (req: Request, res: Response, next: NextFunction) => {
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Remove specific session
        const sessionRemoved = user.removeSession(sessionId);

        if (!sessionRemoved) {
            const err = createHttpError(404, "Session not found");
            return next(err);
        }

        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "User logged out successfully from this device",
            remainingSessions: user.getSessionCount(),
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while logging out user"
        );
        next(err);
    }
};
// send mail to user email via resend

const sendOtpToEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            const err = createHttpError(401, "Invalid or expired session");
            return next(err);
        }

        if (user.isEmailVerify) {
            return res.status(200).json({
                success: true,
                message: "Email is already verified",
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = expiresAt;

        // Update session activity
        user.updateSessionActivity(sessionId);

        await user.save({ validateBeforeSave: false });

        // Send email
        const mailSent = await sendOtpEmail(user.email, otp);
        if (!mailSent) {
            const err = createHttpError(500, "Failed to send OTP email");
            return next(err);
        }

        res.status(200).json({
            success: true,
            message: `OTP sent successfully to ${user.email}`,
            ...(config.env === "development" && { otp }),
        });
    } catch (error) {
        console.error("Send OTP Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while sending OTP"
        );
        next(err);
    }
};

// verifyEmail via otp

const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    const { otp } = req.body;
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;

    try {
        if (!otp || typeof otp !== "number") {
            return res.status(400).json({
                success: false,
                message: "OTP is required and must be a number",
            });
        }

        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            const err = createHttpError(401, "Invalid or expired session");
            return next(err);
        }

        if (user.isEmailVerify) {
            return res.status(200).json({
                success: true,
                message: "Email is already verified",
            });
        }

        if (!user.otp || user.otp === 0) {
            return res.status(400).json({
                success: false,
                message: "No OTP found. Please request a new OTP",
            });
        }

        if (user.otpExpiresAt < new Date()) {
            user.otp = 0;
            user.otpExpiresAt = new Date();
            await user.save({ validateBeforeSave: false });

            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP",
            });
        }

        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }

        // Verify email and clear OTP
        user.isEmailVerify = true;
        user.otp = 0;
        user.otpExpiresAt = new Date();

        // Update session activity
        user.updateSessionActivity(sessionId);

        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
        });
    } catch (error) {
        console.error("Verify Email Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while verifying email"
        );
        next(err);
    }
};

// Force logout user from all devices by user email from all devices

const forecedLogoutAllDevices = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const isValidUser = forceLogoutSchema.parse(req.body);

        const { email } = isValidUser;

        if (!email) {
            const err = createHttpError(400, "User email is required");
            return next(err);
        }

        const user = await User.findOne({ email }).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        const sessionCount = user.getSessionCount();
        user.clearAllSessions();
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: `User logged out from ${sessionCount} devices. User logged out from all devices successfully`,
            clearedSessions: sessionCount,
        });
    } catch (error) {
        console.error("Error forcing logout:", error);
        if (error instanceof z.ZodError) {
            const err = createHttpError(401, {
                message: {
                    type: "Validation zod error",
                    zodError: error.issues,
                },
            });
            next(err);
        } else {
            const err = createHttpError(500, "Error forcing logout");
            next(err);
        }
    }
};

// Logout from all devices
const logoutAllDevices = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Clear all sessions
        user.clearAllSessions();
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "User logged out from all devices successfully",
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while logging out from all devices"
        );
        next(err);
    }
};

// Get all active sessions for current user
const getActiveSessions = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Clean expired sessions first
        const cleanedCount = user.cleanExpiredSessions();
        if (cleanedCount > 0) {
            await user.save({ validateBeforeSave: false });
        }

        const activeSessions = user.getActiveSessions();

        // Map sessions to safe response format (without refresh tokens)
        const sessionInfo = activeSessions.map((session: any) => ({
            sessionId: session.sessionId,
            deviceInfo: session.deviceInfo,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            lastActiveAt: session.lastActiveAt,
            isCurrentSession: session.sessionId === sessionId,
        }));

        res.status(200).json({
            success: true,
            data: {
                activeSessions: sessionInfo,
                totalSessions: activeSessions.length,
                maxSessions: 5,
                currentSessionId: sessionId,
            },
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while getting active sessions"
        );
        next(err);
    }
};

// Logout specific session by session ID
const logoutSpecificSession = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id } = _req;
    const { sessionId: targetSessionId } = req.body;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Remove specific session
        const sessionRemoved = user.removeSession(targetSessionId);

        if (!sessionRemoved) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "Session terminated successfully",
            remainingSessions: user.getSessionCount(),
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while terminating session"
        );
        next(err);
    }
};

// Get active sessions count for a user
const getActiveSessionsCount = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Clean expired sessions first
        const cleanedCount = user.cleanExpiredSessions();
        if (cleanedCount > 0) {
            await user.save({ validateBeforeSave: false });
        }

        const activeSessionCount = user.getSessionCount();

        res.status(200).json({
            success: true,
            data: {
                activeSessionsCount: activeSessionCount,
                maxSessions: 5,
                cleanedExpiredSessions: cleanedCount,
            },
            message: `User has ${activeSessionCount} active sessions`,
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while getting session count"
        );
        next(err);
    }
};

// Check if user has active sessions

const checkUserHasActiveSessions = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Clean expired sessions first
        const cleanedCount = user.cleanExpiredSessions();
        if (cleanedCount > 0) {
            await user.save({ validateBeforeSave: false });
        }

        const activeSessionsCount = user.getSessionCount();
        const hasActiveSessions = activeSessionsCount > 0;

        res.status(200).json({
            success: true,
            data: {
                hasActiveSessions,
                activeSessionsCount,
                maxSessions: 5,
                isLoggedIn: user.isLogin,
            },
            message: hasActiveSessions
                ? `User has ${activeSessionsCount} active sessions`
                : "User has no active sessions",
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while checking active sessions"
        );
        next(err);
    }
};

// Get detailed session information

const getDetailedSessionInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;
    const { targetSessionId } = req.params;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // If no targetSessionId provided, return current session info
        const searchSessionId = targetSessionId || sessionId;
        const session = user.findSession(searchSessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        // Check if session is still valid
        const isValid = user.isSessionValid(searchSessionId);
        const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
        const daysUntilExpiry = Math.ceil(
            timeUntilExpiry / (1000 * 60 * 60 * 24)
        );

        res.status(200).json({
            success: true,
            data: {
                sessionId: session.sessionId,
                deviceInfo: session.deviceInfo,
                createdAt: session.createdAt,
                expiresAt: session.expiresAt,
                lastActiveAt: session.lastActiveAt,
                isValid,
                isCurrentSession: session.sessionId === sessionId,
                timeUntilExpiry: Math.max(0, timeUntilExpiry),
                daysUntilExpiry: Math.max(0, daysUntilExpiry),
                sessionDuration:
                    session.expiresAt.getTime() - session.createdAt.getTime(),
            },
            message: "Session information retrieved successfully",
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while getting session info"
        );
        next(err);
    }
};

// Validate session by session ID

const validateSessionById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id } = _req;
    const { sessionId: targetSessionId } = req.params;

    try {
        if (!targetSessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID is required",
            });
        }

        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        const session = user.findSession(targetSessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
                data: {
                    sessionId: targetSessionId,
                    isValid: false,
                    exists: false,
                },
            });
        }

        const isValid = user.isSessionValid(targetSessionId);
        const timeUntilExpiry = session.expiresAt.getTime() - Date.now();

        if (!isValid) {
            // Remove expired session
            user.removeSession(targetSessionId);
            await user.save({ validateBeforeSave: false });
        }

        res.status(200).json({
            success: true,
            data: {
                sessionId: targetSessionId,
                isValid,
                exists: true,
                timeUntilExpiry: Math.max(0, timeUntilExpiry),
                expiresAt: session.expiresAt,
                lastActiveAt: session.lastActiveAt,
                deviceInfo: session.deviceInfo,
            },
            message: isValid ? "Session is valid" : "Session has expired",
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while validating session"
        );
        next(err);
    }
};

// Get all active sessions across all users (admin function)

const getAllActiveSessionsAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { role } = req.query;

    try {
        // Check if user is admin
        const currentUser = await User.findById(_req._id).select("role");
        if (!currentUser || currentUser.role !== "admin") {
            const err = createHttpError(
                403,
                "Access denied. Admin role required"
            );
            return next(err);
        }

        // Build query filter
        const filter: any = {};
        if (role && typeof role === "string") {
            filter.role = role;
        }

        // Get all users with sessions
        const users = await User.find({
            ...filter,
            sessions: { $exists: true, $not: { $size: 0 } },
        }).select("-password");

        let totalActiveSessions = 0;
        const userSessionsData = [];

        for (const user of users) {
            // Clean expired sessions for each user
            const cleanedCount = user.cleanExpiredSessions();
            if (cleanedCount > 0) {
                await user.save({ validateBeforeSave: false });
            }

            const activeSessions = user.getActiveSessions();
            if (activeSessions.length > 0) {
                totalActiveSessions += activeSessions.length;

                userSessionsData.push({
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    activeSessionsCount: activeSessions.length,
                    isEmailVerified: user.isEmailVerify,
                    status: user.status,
                    sessions: activeSessions.map((session) => ({
                        sessionId: session.sessionId,
                        deviceInfo: session.deviceInfo,
                        createdAt: session.createdAt,
                        expiresAt: session.expiresAt,
                        lastActiveAt: session.lastActiveAt,
                    })),
                });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                totalUsers: userSessionsData.length,
                totalActiveSessions,
                maxSessionsPerUser: 5,
                users: userSessionsData,
                filter: filter,
            },
            message: `Found ${totalActiveSessions} active sessions across ${userSessionsData.length} users`,
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while getting all active sessions"
        );
        next(err);
    }
};

// Get session statistics for admin role

const getSessionStatisticsAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;

    try {
        // Check if user is admin
        const currentUser = await User.findById(_req._id).select("role");
        if (!currentUser || currentUser.role !== "admin") {
            const err = createHttpError(
                403,
                "Access denied. Admin role required"
            );
            return next(err);
        }

        // Get all users
        const allUsers = await User.find({}).select("-password");

        let totalUsers = allUsers.length;
        let usersWithActiveSessions = 0;
        let totalActiveSessions = 0;
        let totalExpiredSessionsCleaned = 0;

        const roleStats: Record<
            string,
            {
                totalUsers: number;
                usersWithActiveSessions: number;
                totalActiveSessions: number;
            }
        > = {};

        const deviceStats: Record<string, number> = {};

        for (const user of allUsers) {
            // Clean expired sessions
            const cleanedCount = user.cleanExpiredSessions();
            totalExpiredSessionsCleaned += cleanedCount;

            if (cleanedCount > 0) {
                await user.save({ validateBeforeSave: false });
            }

            const activeSessions = user.getActiveSessions();
            const hasActiveSessions = activeSessions.length > 0;

            if (hasActiveSessions) {
                usersWithActiveSessions++;
                totalActiveSessions += activeSessions.length;
            }

            // Role statistics - Initialize if doesn't exist
            if (!roleStats[user.role]) {
                roleStats[user.role] = {
                    totalUsers: 0,
                    usersWithActiveSessions: 0,
                    totalActiveSessions: 0,
                };
            }

            // Use non-null assertion since we know it exists after initialization
            roleStats[user.role]!.totalUsers++;
            if (hasActiveSessions) {
                roleStats[user.role]!.usersWithActiveSessions++;
                roleStats[user.role]!.totalActiveSessions +=
                    activeSessions.length;
            }

            // Device statistics
            activeSessions.forEach((session) => {
                const deviceType = session.deviceInfo?.deviceType || "unknown";
                deviceStats[deviceType] = (deviceStats[deviceType] || 0) + 1;
            });
        }

        // Calculate percentages and averages
        const activeSessionsPercentage =
            totalUsers > 0 ? (usersWithActiveSessions / totalUsers) * 100 : 0;
        const avgSessionsPerUser =
            usersWithActiveSessions > 0
                ? totalActiveSessions / usersWithActiveSessions
                : 0;
        const avgSessionsPerAllUsers =
            totalUsers > 0 ? totalActiveSessions / totalUsers : 0;

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    usersWithActiveSessions,
                    usersWithoutActiveSessions:
                        totalUsers - usersWithActiveSessions,
                    totalActiveSessions,
                    totalExpiredSessionsCleaned,
                    maxSessionsPerUser: 5,
                },
                percentages: {
                    activeSessionsPercentage:
                        Math.round(activeSessionsPercentage * 100) / 100,
                    inactiveUsersPercentage:
                        Math.round((100 - activeSessionsPercentage) * 100) /
                        100,
                },
                averages: {
                    avgSessionsPerActiveUser:
                        Math.round(avgSessionsPerUser * 100) / 100,
                    avgSessionsPerAllUsers:
                        Math.round(avgSessionsPerAllUsers * 100) / 100,
                },
                roleStatistics: roleStats,
                deviceStatistics: deviceStats,
                systemLimits: {
                    maxSessionsPerUser: 5,
                    sessionDuration: "7 days",
                    accessTokenDuration: "15 minutes",
                },
            },
            message: "Session statistics retrieved successfully",
        });
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while getting session statistics"
        );
        next(err);
    }
};

// Forget password

// 1. Change password for logged-in user (with Zod validation)
const changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;

    try {
        // Validate request body with Zod
        const validatedData = changePasswordSchema.parse(req.body);
        const { currentPassword, newPassword } = validatedData;

        // Find user
        const user = await User.findById(_id);
        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            const err = createHttpError(401, "Invalid or expired session");
            return next(err);
        }

        // Verify current password
        const isCurrentPasswordCorrect =
            await user.isPasswordCorrect(currentPassword);
        if (!isCurrentPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
            });
        }

        // Update password (it will be hashed automatically by the pre-save middleware)
        user.password = newPassword;

        // Update session activity
        user.updateSessionActivity(sessionId);

        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
            data: {
                changedAt: new Date(),
                activeSessionsCount: user.getSessionCount(),
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            const err = createHttpError(400, {
                message: {
                    type: "Validation error",
                    zodError: error.issues,
                },
            });
            return next(err);
        }

        console.error("Change Password Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while changing password"
        );
        next(err);
    }
};

// 2. Forgot password - Send OTP to email (with Zod validation)
const forgotPasswordSendOtp = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Validate request body with Zod
        const validatedData = forgotPasswordSendOtpSchema.parse(req.body);
        const { email } = validatedData;

        const user = await User.findOne({ email }).select("-password");

        if (!user) {
            // not  reveal if user exists or not for security
            return res.status(200).json({
                success: true,
                message:
                    "If the email exists in our system, an OTP has been sent",
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for forgot password

        user.otp = otp;
        user.otpExpiresAt = expiresAt;

        await user.save({ validateBeforeSave: false });

        // Send email
        const mailSent = await sendOtpEmail(user.email, otp);
        if (!mailSent) {
            const err = createHttpError(500, "Failed to send OTP email");
            return next(err);
        }

        res.status(200).json({
            success: true,
            message: "If the email exists in our system, an OTP has been sent",
            ...(config.env === "development" && { otp, email: user.email }),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            const err = createHttpError(400, {
                message: {
                    type: "Validation error",
                    zodError: error.issues,
                },
            });
            return next(err);
        }

        console.error("Forgot Password Send OTP Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while sending OTP"
        );
        next(err);
    }
};
// 3. Reset password with OTP verification (with Zod validation)
const resetPasswordWithOtp = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Validate request body with Zod
        const validatedData = resetPasswordWithOtpSchema.parse(req.body);
        const { email, otp, newPassword } = validatedData;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid email or OTP",
            });
        }

        // Verify OTP
        if (!user.otp || user.otp === 0) {
            return res.status(400).json({
                success: false,
                message: "No OTP found. Please request a new OTP",
            });
        }

        if (user.otpExpiresAt < new Date()) {
            user.otp = 0;
            user.otpExpiresAt = new Date();
            await user.save({ validateBeforeSave: false });

            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP",
            });
        }

        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }

        // Check if new password is same as current password
        const isSamePassword = await user.isPasswordCorrect(newPassword);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from current password",
            });
        }

        // Get current session count before clearing
        const currentSessionsCount = user.getSessionCount();

        // Update password (will be hashed by pre-save middleware)
        user.password = newPassword;

        // Clear OTP
        user.otp = 0;
        user.otpExpiresAt = new Date();

        // Logout from all devices for security
        user.clearAllSessions();

        await user.save();

        res.status(200).json({
            success: true,
            message:
                "Password reset successfully. You have been logged out from all devices.",
            data: {
                resetAt: new Date(),
                clearedSessions: currentSessionsCount,
                message: "Please login again with your new password",
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            const err = createHttpError(400, {
                message: {
                    type: "Validation error",
                    zodError: error.issues,
                },
            });
            return next(err);
        }

        console.error("Reset Password Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while resetting password"
        );
        next(err);
    }
};

// 4. Change password and logout from all other devices (with Zod validation)
const changePasswordAndLogoutOthers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const _req = req as AuthRequest;
    const { _id, sessionId } = _req;

    try {
        // Validate request body with Zod
        const validatedData = changePasswordSchema.parse(req.body);
        const { currentPassword, newPassword } = validatedData;

        // Find user
        const user = await User.findById(_id);
        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            const err = createHttpError(401, "Invalid or expired session");
            return next(err);
        }

        // Verify current password
        const isCurrentPasswordCorrect =
            await user.isPasswordCorrect(currentPassword);
        if (!isCurrentPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
            });
        }

        // Get current session info to preserve it
        const currentSession = user.findSession(sessionId);
        const totalSessionsCount = user.getSessionCount();

        // Update password
        user.password = newPassword;

        // Clear all sessions
        user.clearAllSessions();

        // Recreate current session if it existed
        if (currentSession) {
            const deviceInfo = currentSession.deviceInfo;
            const { sessionId: newSessionId, refreshToken } =
                user.createSession(deviceInfo);

            await user.save();

            // Generate new access token
            const accessToken = user.generateAccessToken(newSessionId);

            res.status(200).json({
                success: true,
                message:
                    "Password changed successfully. You have been logged out from all other devices.",
                data: {
                    changedAt: new Date(),
                    clearedSessions: totalSessionsCount - 1, // -1 because we kept current session
                    newTokens: {
                        accessToken,
                        refreshToken,
                        sessionId: newSessionId,
                    },
                    message:
                        "Please update your tokens and continue using the current session",
                },
            });
        } else {
            await user.save();

            res.status(200).json({
                success: true,
                message:
                    "Password changed successfully. You have been logged out from all devices.",
                data: {
                    changedAt: new Date(),
                    clearedSessions: totalSessionsCount,
                    message: "Please login again with your new password",
                },
            });
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const err = createHttpError(400, {
                message: {
                    type: "Validation error",
                    zodError: error.issues,
                },
            });
            return next(err);
        }

        console.error("Change Password and Logout Others Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while changing password"
        );
        next(err);
    }
};

// Get user profile
const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
    const _req = req as AuthRequest;
    const { _id, sessionId, isAccessTokenExp } = _req;

    try {
        const user = await User.findById(_id).select("-password");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            const err = createHttpError(401, "Invalid or expired session");
            return next(err);
        }

        // Update session activity
        user.updateSessionActivity(sessionId);
        await user.save({ validateBeforeSave: false });
        // Handle access token expiration
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            const updateResult = user.updateSessionActivity(sessionId);
            newAccessToken = user.generateAccessToken(sessionId);

            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }
        } else {
            user.updateSessionActivity(sessionId);
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phoneNumber: user.phoneNumber,
                userProfileUrl: user.userProfileUrl,
                isEmailVerified: user.isEmailVerify,
                status: user.status,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                isAccessTokenExp,
                accessToken: isAccessTokenExp ? newAccessToken : null,
                refreshToken: isAccessTokenExp ? newRefreshToken : null,
                activeSessionsCount: user.getSessionCount(),
                maxSessions: 5,
                message: isAccessTokenExp
                    ? "Access token was expired. A new access token has been issued."
                    : "Access token is still valid.",
                ...(user.employeeDetails && {
                    employeeDetails: {
                        propertyOwnerId: user.employeeDetails.propertyOwnerId,
                        propertyId: user.employeeDetails.propertyId,
                        assignedAt: user.employeeDetails.assignedAt
                    }
                })
            }
        });
    } catch (error) {
        console.error("Get Profile Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while retrieving profile"
        );
        next(err);
    }
};

// uploadUserProfileImage
const uploadUserProfileImage = async (req: Request, res: Response, next: NextFunction) => {
    let fileToDelete: string | null = null;

    try {
        const _req = req as AuthRequest;
        const { _id, sessionId, isAccessTokenExp } = _req;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        console.log("Received files for profile upload:", files);

        // Validate user
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        // Validate session
        if (!user.isSessionValid(sessionId)) {
            return next(createHttpError(401, "Invalid or expired session"));
        }

        // Check if profile image is provided - Error 1 Fix
        if (!files || !files.userProfileImage || files.userProfileImage.length === 0) {
            return next(createHttpError(400, "Profile image is required"));
        }

        const profileImageFile = files.userProfileImage[0];
        if (!profileImageFile) {
            return next(createHttpError(400, "Profile image file is missing"));
        }

        // Get file path and track for cleanup
        const imagePath = getFilePath(profileImageFile); // Now profileImageFile is guaranteed to be defined
        if (!imagePath) {
            return next(createHttpError(400, "Invalid file path"));
        }

        fileToDelete = imagePath;

        // Check if file exists
        const fileExists = await checkFileExists(imagePath);
        if (!fileExists) {
            // Clean up if file doesn't exist
            if (fileToDelete) {
                await safeDeleteFile(fileToDelete);
            }
            return next(createHttpError(400, "Uploaded file not found"));
        }

        // Delete old profile image from Cloudinary if exists
        if (user.userProfileUrl && user.userProfileUrl.trim() !== "") {
            const oldPublicId = extractPublicIdFromUrl(user.userProfileUrl);
            if (oldPublicId) {
                console.log(`Attempting to delete old profile image with public_id: ${oldPublicId}`);
                const deleted = await deleteImageFromCloudinary(oldPublicId);
                if (deleted) {
                    console.log("Successfully deleted old profile image from Cloudinary");
                } else {
                    console.log("Failed to delete old profile image, but continuing with upload");
                }
            }
        }

        // Upload new profile image to Cloudinary
        let uploadResult: { url: string; public_id: string };

        try {
            console.log("Uploading new profile image to Cloudinary...");
            uploadResult = await uploadProfileImageToCloudinary(imagePath, _id.toString());
            console.log("Profile image upload result:", uploadResult);
        } catch (uploadError) {
            console.error("Error uploading profile image:", uploadError);
            // Clean up local file on upload failure
            if (fileToDelete) {
                await safeDeleteFile(fileToDelete);
            }
            return next(createHttpError(500, "Failed to upload profile image to Cloudinary"));
        }

        // Clean up local file after successful upload - Cleanup Fix
        if (fileToDelete) {
            await safeDeleteFile(fileToDelete);
            fileToDelete = null; // Prevent double cleanup
        }

        // Handle access token expiration and session update - Token Fix
        let newAccessToken = null;
        let newRefreshToken = null;

        if (isAccessTokenExp) {
            const updateResult = user.updateSessionActivity(sessionId);
            newAccessToken = user.generateAccessToken(sessionId);

            if (updateResult && typeof updateResult === 'object' && updateResult.extended) {
                newRefreshToken = updateResult.newRefreshToken;
            }
        }

        // Update user profile URL in database
        user.userProfileUrl = uploadResult.url;

        // Update session activity
        user.updateSessionActivity(sessionId);

        try {
            await user.save({ validateBeforeSave: false });
        } catch (saveError) {
            console.error("Error saving user profile:", saveError);
            // Consider rolling back Cloudinary upload here if needed
            return next(createHttpError(500, "Failed to update user profile"));
        }

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            data: {
                userProfileUrl: uploadResult.url,
                cloudinaryPublicId: uploadResult.public_id,
                uploadedAt: new Date()
            },
            isAccessTokenExp,
            accessToken: isAccessTokenExp ? newAccessToken : null,
            refreshToken: isAccessTokenExp ? newRefreshToken : null
        });

    } catch (error) {
        console.error("Upload profile image error:", error);

        // Clean up uploaded file in case of error
        if (fileToDelete) {
            await safeDeleteFile(fileToDelete);
        }

        if (error instanceof Error) {
            return next(createHttpError(500, error.message));
        }

        next(createHttpError(500, "Internal server error while uploading profile image"));
    }
};

// Utility functions
const checkFileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

const safeDeleteFile = async (filePath: string): Promise<void> => {
    try {
        if (await checkFileExists(filePath)) {
            await fs.unlink(filePath);
            console.log(`Successfully deleted: ${filePath}`);
        }
    } catch (error) {
        console.log(`Error deleting file ${filePath}:`, (error as Error).message);
    }
};

const getFilePath = (file: Express.Multer.File): string | null => {
    try {
        if (file.path) {
            return file.path;
        }
        if (file.filename) {
            return path.resolve(
                process.cwd(),
                "public/data/uploads",
                file.filename
            );
        }
        return null;
    } catch (error) {
        console.error("Error getting file path:", error);
        return null;
    }
};

export {
    createUser,
    loginUser,
    logoutUser,
    sendOtpToEmail,
    verifyEmail,
    forecedLogoutAllDevices,
    logoutAllDevices,
    getActiveSessions,
    logoutSpecificSession,
    getActiveSessionsCount,
    checkUserHasActiveSessions,
    getDetailedSessionInfo,
    validateSessionById,
    getAllActiveSessionsAdmin,
    getSessionStatisticsAdmin,
    forgotPasswordSendOtp,
    changePassword,
    resetPasswordWithOtp,
    changePasswordAndLogoutOthers,
    createEmployee,
    logoutUserBySessionId,
    getUserProfile,
    uploadUserProfileImage,
    getAllEmployeesForPropertyOwner,
    // test
    // updateEmployeeDetails,
    // deleteEmployeeById,
    // forceLogoutEmployeeById,
    // updateUserStatusByAdmin,
};
