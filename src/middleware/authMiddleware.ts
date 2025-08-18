import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { User } from "../user/userModel.js";

export interface AuthRequest extends Request {
    _id: string;
    email: string;
    isLogin: boolean;
    isAccessTokenExp: boolean;
    sessionId: string;
}

// Helper function to extract and verify a token
const verifyToken = (token: string, secret: string) => {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        throw err;
    }
};

const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        return next(createHttpError(401, "Auth token is required"));
    }

    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
        return next(createHttpError(401, "Access token not provided"));
    }

    try {
        // Verify the access token
        const decoded = verifyToken(
            accessToken,
            config.JWT_ACCESS_KEY as string
        ) as jwt.JwtPayload;

        // Add validation for required fields
        if (!decoded._id || !decoded.email || !decoded.sessionId) {
            return next(createHttpError(401, "Invalid token payload"));
        }

        const { isLogin, email, _id, sessionId } = decoded;

        // Validate session in database
        const user = await User.findById(_id).select("-password");
        if (!user) {
            return next(createHttpError(401, "User not found"));
        }

        // Check if session exists and is valid
        if (!user.isSessionValid(sessionId)) {
            // Remove invalid session
            user.removeSession(sessionId);
            await user.save({ validateBeforeSave: false });
            return next(
                createHttpError(
                    401,
                    "Session expired or invalid. Please login again."
                )
            );
        }

        // Update session activity (auto-extends if needed)
        const updateResult = user.updateSessionActivity(sessionId);
        if (updateResult !== false) {
            await user.save({ validateBeforeSave: false });
        }

        const _req = req as AuthRequest;
        _req.email = email;
        _req._id = _id;
        _req.isLogin = isLogin || false;
        _req.isAccessTokenExp = false;
        _req.sessionId = sessionId;

        return next();
    } catch (err: any) {
        console.log("Access token error:", err.message);

        // Handle expired access token - try refresh token
        if (err.name === "TokenExpiredError") {
            const refreshTokenHeader = req.header("refreshToken");
            if (!refreshTokenHeader) {
                return next(createHttpError(401, "Refresh token not found"));
            }

            const refreshToken = refreshTokenHeader.split(" ")[1];
            if (!refreshToken) {
                return next(
                    createHttpError(401, "Invalid refresh token format")
                );
            }

            try {
                // Verify the refresh token
                const decoded = verifyToken(
                    refreshToken,
                    config.JWT_REFRESH_KEY as string
                ) as jwt.JwtPayload;

                // Add validation for required fields
                if (!decoded._id || !decoded.email || !decoded.sessionId) {
                    return next(
                        createHttpError(401, "Invalid refresh token payload")
                    );
                }

                const { isLogin, email, _id, sessionId } = decoded;

                // Validate session and refresh token in database
                const user = await User.findById(_id).select("-password");
                if (!user) {
                    return next(createHttpError(401, "User not found"));
                }

                // Validate the refresh token
                const tokenValidation = user.validateRefreshToken(
                    `Bearer ${refreshToken}`
                );
                if (!tokenValidation.valid) {
                    if (tokenValidation.reason === "Refresh token expired") {
                        // Remove expired session
                        user.removeSession(sessionId);
                        await user.save({ validateBeforeSave: false });
                    }
                    return next(
                        createHttpError(
                            401,
                            `${tokenValidation.reason}. Please log in again.`
                        )
                    );
                }

                // Check if session ID matches
                if (tokenValidation.sessionId !== sessionId) {
                    return next(
                        createHttpError(
                            401,
                            "Session mismatch. Please log in again."
                        )
                    );
                }

                // Update session activity and auto-extend if needed
                const updateResult = user.updateSessionActivity(sessionId);
                if (updateResult !== false) {
                    await user.save({ validateBeforeSave: false });
                }

                const _req = req as AuthRequest;
                _req._id = _id;
                _req.isLogin = isLogin || false;
                _req.email = email;
                _req.isAccessTokenExp = true;
                _req.sessionId = sessionId;

                return next();
            } catch (error: any) {
                console.log("Refresh token error:", error.message);
                return next(
                    createHttpError(
                        401,
                        "Invalid or expired refresh token. Please log in again."
                    )
                );
            }
        }

        // Handle other JWT errors
        if (err.name === "JsonWebTokenError") {
            return next(
                createHttpError(
                    401,
                    "Malformed access token. Please log in again."
                )
            );
        }

        if (err.name === "NotBeforeError") {
            return next(
                createHttpError(
                    401,
                    "Token not active yet. Please log in again."
                )
            );
        }

        return next(
            createHttpError(401, "Invalid access token. Please log in again.")
        );
    }
};

// Optional: Middleware to check session without full authentication
const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
        return next(); // Continue without authentication
    }

    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
        return next(); // Continue without authentication
    }

    try {
        const decoded = verifyToken(
            accessToken,
            config.JWT_ACCESS_KEY as string
        ) as jwt.JwtPayload;

        if (decoded._id && decoded.email && decoded.sessionId) {
            // Validate session
            const user = await User.findById(decoded._id).select("-password");
            if (user && user.isSessionValid(decoded.sessionId)) {
                const _req = req as AuthRequest;
                _req._id = decoded._id;
                _req.email = decoded.email;
                _req.isLogin = decoded.isLogin || false;
                _req.sessionId = decoded.sessionId;
                _req.isAccessTokenExp = false;

                // Update session activity
                user.updateSessionActivity(decoded.sessionId);
                await user.save({ validateBeforeSave: false });
            }
        }
    } catch (error) {
        // Ignore errors in optional authentication
        console.log("Optional auth error:", error);
    }

    return next();
};

export default authenticate;
export { optionalAuth };
