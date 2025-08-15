import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z, ZodError } from "zod";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { createUserSchema, loginUserSchema } from "./userZodSchema.js";
import { Resend } from "resend";
import { User } from "./userModel.js";
import { config } from "../config/index.js";

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
            role,
            status: "active",
            otp: 0,
            otpExpiresAt: Date.now(),
        });
        if (newUser) {
            console.log("newUser", newUser);

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

const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isValidUser = loginUserSchema.parse(req.body);
        const { email, password } = isValidUser;
        const user = await User.findOne({
            email,
        });
        if (user) {
            // allowed if not login
            if (user.isLogin) {
                const err = createHttpError(401, "User is already login");
                return next(err);
            }

            const isPasswordCorrect = await user.isPasswordCorrect(password);
            console.log(isPasswordCorrect);
            if (!isPasswordCorrect) {
                const err = createHttpError(400, "Invalid  password");
                return next(err);
            }
            const accessToken = user.generateAccessToken();
            const refreshToken = user.generateRefreshToken();
            // Update user details
            user.refreshToken = refreshToken;

            user.isLogin = true;
            await user.save({ validateBeforeSave: false });
            res.status(201).json({
                success: true,
                message: "User is login successfully",
                accessToken: accessToken,
                refreshToken: refreshToken,
                userDetails: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            });
        } else {
            const err = createHttpError(401, "User does not exist");
            next(err);
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
                "Internal server error while creating user"
            );

            next(err);
        }
    }
};
const logoutUser = async (req: Request, res: Response, next: NextFunction) => {
    // const _req = req as AuthRequest
    const _req = req as AuthRequest;
    const { _id, email, isLogin, isAccessTokenExp } = _req;
    console.log("_req", _req);

    try {
        const user = await User.findById({ _id }).select("-password");
        if (user) {
            user.isLogin = false;
            user.refreshToken = "";
            await user.save({ validateBeforeSave: false });
            res.status(201).json({
                success: true,
                message: "User is successfully logout",
            });
        }
    } catch (error) {
        const err = createHttpError(
            500,
            "Internal server error while logout user"
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
    const { _id, email, isLogin, isAccessTokenExp } = _req;
    console.log("_req", _req);

    try {
        const user = await User.findById(_id).select("-password -refreshToken");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        if (!user.isLogin) {
            const err = createHttpError(
                401,
                "User is not login. Kindly login first!"
            );
            return next(err);
        }

        // Check if user email is already verified
        if (user.isEmailVerify) {
            return res.status(200).json({
                success: true,
                message: "Email is already verified",
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Save OTP in DB with expiry (5 minutes from now)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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
            message: `OTP sent successfully to ${user.email}`,
            // For development/testing purposes, you might want to include the OTP
            // Remove this in production
            ...(config.env === "development" && { otp }),
        });
    } catch (error) {
        console.error("Send OTP Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while sending OTP to user email"
        );
        next(err);
    }
};

// verifyEmail via otp

const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    const { otp } = req.body;
    const _req = req as AuthRequest;
    const { _id, email, isLogin, isAccessTokenExp } = _req;

    try {
        // Validate OTP input
        if (!otp || typeof otp !== "number") {
            return res.status(400).json({
                success: false,
                message: "OTP is required and must be a number",
            });
        }

        const user = await User.findById(_id).select("-password -refreshToken");

        if (!user) {
            const err = createHttpError(404, "User not found");
            return next(err);
        }

        if (!user.isLogin) {
            const err = createHttpError(
                401,
                "User is not login. Kindly login first!"
            );
            return next(err);
        }

        // Check if email is already verified
        if (user.isEmailVerify) {
            return res.status(200).json({
                success: true,
                message: "Email is already verified",
            });
        }

        // Check if OTP exists and is not expired
        if (!user.otp || user.otp === 0) {
            return res.status(400).json({
                success: false,
                message: "No OTP found. Please request a new OTP",
            });
        }

        // Check OTP expiry
        if (user.otpExpiresAt < new Date()) {
            // Clear expired OTP
            user.otp = 0;
            user.otpExpiresAt = new Date();
            await user.save({ validateBeforeSave: false });

            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP",
            });
        }

        // Verify OTP
        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }

        // OTP is valid - verify email and clear OTP
        user.isEmailVerify = true;
        user.otp = 0;
        user.otpExpiresAt = new Date(); // Reset expiry time
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
        });
    } catch (error) {
        console.error("Verify Email Error:", error);
        const err = createHttpError(
            500,
            "Internal server error while verifying OTP for user email"
        );
        next(err);
    }
};

export { createUser, loginUser, logoutUser, sendOtpToEmail, verifyEmail };
