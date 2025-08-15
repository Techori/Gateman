import mongoose from "mongoose";
import type { Users } from "./userType.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";

const userSchema = new mongoose.Schema<Users>(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            maxlength: [24, "Name cannot exceed 24 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
        },
        role: {
            type: String,
            enum: {
                values: [
                    "admin",
                    "gateKeeper",
                    "propertyOwener",
                    "reception",
                    "client",
                ],
                message: "Please select a valid role",
            },
            default: "client",
        },
        phoneNumber: {
            type: String,
            trim: true,
            required: true,

            maxlength: 10,
        },

        refreshToken: {
            type: String,
        },
        isLogin: {
            type: Boolean,
            default: false,
        },
        isEmailVerify: {
            type: Boolean,
            default: false,
        },
        otp: {
            type: Number,
            default: 0,
        },
        otpExpiresAt: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: {
                values: ["active", "nonActive"],
                message: "Please select a valid status",
            },
            default: "nonActive",
        },
    },
    { timestamps: true }
);

// Encrypt password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword: string) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isPasswordCorrect = async function (password: string) {
    const result = await bcrypt.compare(password, this.password);
    return result;
};
// token genration
userSchema.methods.generateAccessToken = function () {
    const token = generateAccessToken({
        _id: this._id,
        email: this.email,
        isLogin: true,
    });
    return `Bearer ${token}`;
};

userSchema.methods.generateRefreshToken = function () {
    const token = generateRefreshToken({
        _id: this._id,
        email: this.email,
        isLogin: true,
    });
    return `Bearer ${token}`;
};

export const User = mongoose.model("User", userSchema);
