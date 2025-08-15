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

export { createUserSchema, loginUserSchema };
