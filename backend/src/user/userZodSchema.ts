import { z } from "zod";

const createUserSchema = z.object({
    name: z.string().trim(),
    email: z.string().trim().email({ message: "Invalid email address" }),
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

export {
    createUserSchema,
    loginUserSchema,
    sessionIdSchema,
    forceLogoutSchema,
    logoutSpecificSessionSchema,
    changePasswordSchema,
    forgotPasswordSendOtpSchema,
    resetPasswordWithOtpSchema,
};
