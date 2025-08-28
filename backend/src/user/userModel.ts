import mongoose from "mongoose";
import type { Users, UserSession } from "./userType.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { v4 as uuidv4 } from "uuid";


// Employee schema 
const employeeSchema = new mongoose.Schema({
    propertyOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true
    },
    assignedAt: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true,
    _id: false  
})

// Session interface for individual sessions

const sessionSchema = new mongoose.Schema<UserSession>(
    {
        sessionId: {
            type: String,
            required: true,
        },
        refreshToken: {
            type: String,
            required: true,
        },
        deviceInfo: {
            userAgent: String,
            ipAddress: String,
            deviceType: String,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        lastActiveAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

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
        // Array of active sessions (max 5)
        sessions: {
            type: [sessionSchema],
            default: [],
            validate: {
                validator: function (sessions: UserSession[]) {
                    return sessions.length <= 5;
                },
                message: "Maximum 5 active sessions allowed",
            },
        },
        employeeDetails: {
            type: employeeSchema,
            default: null,
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
// Generate access token for specific session
userSchema.methods.generateAccessToken = function (sessionId: string) {
    const token = generateAccessToken({
        _id: this._id,
        email: this.email,
        isLogin: true,
        sessionId: sessionId,
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

// Create new session
userSchema.methods.createSession = function (deviceInfo?: any) {
    const uuid = uuidv4();
    const sessionId = `${Date.now()}-${uuid}`;
    const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 days for refresh token
    const expiresAt = new Date(Date.now() + sessionDuration);

    // Generate refresh token for this session
    const refreshTokenPayload = {
        _id: this._id,
        email: this.email,
        sessionId: sessionId,
        isLogin: true,
    };
    const refreshToken = generateRefreshToken(refreshTokenPayload);

    const newSession: UserSession = {
        sessionId,
        refreshToken,
        deviceInfo: deviceInfo || {},
        createdAt: new Date(),
        expiresAt,
        lastActiveAt: new Date(),
    };

    // Remove oldest session if we have 5 sessions
    if (this.sessions.length >= 5) {
        // Remove the oldest session (first in array)
        this.sessions.shift();
    }

    // Add new session
    this.sessions.push(newSession);
    this.isLogin = true;

    return { sessionId, refreshToken: `Bearer ${refreshToken}` };
};

// Find session by session ID
userSchema.methods.findSession = function (sessionId: string) {
    return this.sessions.find(
        (session: UserSession) => session.sessionId === sessionId
    );
};

// Check if session is valid
userSchema.methods.isSessionValid = function (sessionId: string) {
    const session = this.findSession(sessionId);
    if (!session) return false;

    return new Date() < session.expiresAt;
};

// Update session activity and extend expiry if needed
userSchema.methods.updateSessionActivity = function (sessionId: string) {
    const session = this.findSession(sessionId);
    if (!session) return false;

    session.lastActiveAt = new Date();

    // Auto-extend session if it's within 24 hours of expiry
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    if (timeUntilExpiry < oneDayInMs) {
        // Extend by 7 days
        const extensionTime = 7 * 24 * 60 * 60 * 1000;
        session.expiresAt = new Date(Date.now() + extensionTime);

        // Generate new refresh token
        const refreshTokenPayload = {
            _id: this._id,
            email: this.email,
            sessionId: sessionId,
            isLogin: true,
        };
        const newRefreshToken = generateRefreshToken(refreshTokenPayload);
        session.refreshToken = newRefreshToken;

        return {
            extended: true,
            newRefreshToken: `Bearer ${newRefreshToken}`,
            newExpiresAt: session.expiresAt,
        };
    }

    return { extended: false };
};

// Remove session by session ID
userSchema.methods.removeSession = function (sessionId: string) {
    const initialLength = this.sessions.length;
    this.sessions = this.sessions.filter(
        (session: UserSession) => session.sessionId !== sessionId
    );

    // If no sessions left, set isLogin to false
    if (this.sessions.length === 0) {
        this.isLogin = false;
        this.refreshToken = ""; // Clear legacy refresh token
    }

    return this.sessions.length < initialLength;
};

// Remove session by refresh token
userSchema.methods.removeSessionByRefreshToken = function (
    refreshToken: string
) {
    const cleanToken = refreshToken.replace("Bearer ", "");
    const session = this.sessions.find(
        (s: UserSession) => s.refreshToken === cleanToken
    );

    if (session) {
        return this.removeSession(session.sessionId);
    }

    return false;
};

// Clear all sessions
userSchema.methods.clearAllSessions = function () {
    this.sessions = [];
    this.isLogin = false;
    this.refreshToken = "";
};

// Validate refresh token and return session info
userSchema.methods.validateRefreshToken = function (refreshToken: string) {
    const cleanToken = refreshToken.replace("Bearer ", "");
    const session = this.sessions.find(
        (s: UserSession) => s.refreshToken === cleanToken
    );

    if (!session) {
        return { valid: false, reason: "Refresh token not found" };
    }

    if (new Date() > session.expiresAt) {
        // Remove expired session
        this.removeSession(session.sessionId);
        return { valid: false, reason: "Refresh token expired" };
    }

    return {
        valid: true,
        sessionId: session.sessionId,
        session: session,
    };
};

// Get all active sessions
userSchema.methods.getActiveSessions = function () {
    const now = new Date();
    return this.sessions.filter(
        (session: UserSession) => session.expiresAt > now
    );
};

// Get session count
userSchema.methods.getSessionCount = function () {
    return this.sessions.length;
};

// Clean expired sessions
userSchema.methods.cleanExpiredSessions = function () {
    const initialLength = this.sessions.length;
    const now = new Date();
    this.sessions = this.sessions.filter(
        (session: UserSession) => session.expiresAt > now
    );

    // If no sessions left, set isLogin to false
    if (this.sessions.length === 0) {
        this.isLogin = false;
        this.refreshToken = "";
    }

    return initialLength - this.sessions.length; // Return number of cleaned sessions
};

export const User = mongoose.model("User", userSchema);
