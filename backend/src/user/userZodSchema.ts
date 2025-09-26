import { z } from "zod";

const createUserSchema = z.object({
    name: z.string().trim(),
    email: z.email().trim(),
    role: z.enum([
        "admin",
        "gateKeeper",
        "propertyOwener",
        "reception",
        "client",
    ]),
    phoneNumber: z
        .string()
        .min(1, "Phone number is required")
        .max(10, "Phone number must be 10 digits"),
    password: z
        .string()
        .trim()
        .min(6, { message: "Must be 6 or more characters long" }),
});

const createEmployeeSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email({ message: "Invalid email address" }),
    role: z.enum([
        "gateKeeper",
        "reception",
    ]).refine((val) => ["gateKeeper", "reception"].includes(val), {
        message: "Role must be either 'gateKeeper' or 'reception'",
    }),
    phoneNumber: z
        .string()
        .min(10, "Phone number must be exactly 10 digits")
        .max(10, "Phone number must be exactly 10 digits")
        .regex(/^\d{10}$/, "Phone number must contain only digits"),
    password: z
        .string()
        .trim()
        .min(6, { message: "Password must be at least 6 characters long" }),
    propertyId: z
        .string()
        .min(1, "Property ID is required")
        .regex(/^[0-9a-fA-F]{24}$/, "Property ID must be a valid MongoDB ObjectId")
});

const loginUserSchema = z.object({
    email: z.string().trim().email({ message: "Invalid email address" }),
    password: z
        .string()
        .trim()
        .min(6, { message: "Must be 6 or more characters long" }),
});

const sessionIdSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
});

const forceLogoutSchema = z.object({
    email: z.string().email("Valid email is required"),
});

const logoutSpecificSessionSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
});

const changePasswordSchema = z
    .object({
        currentPassword: z.string().trim().min(6, {
            message: "Current password must be at least 6 characters long",
        }),
        newPassword: z.string().trim().min(6, {
            message: "New password must be at least 6 characters long",
        }),
        confirmPassword: z.string().trim().min(6, {
            message: "Confirm password must be at least 6 characters long",
        }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "New password and confirm password do not match",
        path: ["confirmPassword"],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: "New password must be different from current password",
        path: ["newPassword"],
    });

const forgotPasswordSendOtpSchema = z.object({
    email: z.string().trim().email({ message: "Invalid email address" }),
});

const resetPasswordWithOtpSchema = z
    .object({
        email: z.string().trim().email({ message: "Invalid email address" }),
        otp: z
            .number()
            .min(100000)
            .max(999999, { message: "OTP must be a 6-digit number" }),
        newPassword: z.string().trim().min(6, {
            message: "New password must be at least 6 characters long",
        }),
        confirmPassword: z.string().trim().min(6, {
            message: "Confirm password must be at least 6 characters long",
        }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "New password and confirm password do not match",
        path: ["confirmPassword"],
    });

const pageSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10),
});

export {
    createUserSchema,
    loginUserSchema,
    sessionIdSchema,
    forceLogoutSchema,
    logoutSpecificSessionSchema,
    changePasswordSchema,
    forgotPasswordSendOtpSchema,
    resetPasswordWithOtpSchema,
    createEmployeeSchema,
    pageSchema,
};