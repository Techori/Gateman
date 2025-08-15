import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export interface AuthRequest extends Request {
    _id: string;
    email: string;
    isLogin: boolean;
    isAccessTokenExp: boolean;
}

// Helper function to extract and verify a token
const verifyToken = (token: string, secret: string) => {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        throw err;
    }
};

const authenticate = (req: Request, res: Response, next: NextFunction) => {
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
        if (!decoded._id || !decoded.email) {
            return next(createHttpError(401, "Invalid token payload"));
        }

        const { isLogin, email, _id } = decoded;

        const _req = req as AuthRequest;
        _req.email = email;
        _req._id = _id;
        _req.isLogin = isLogin || false; // Default to false if not present
        _req.isAccessTokenExp = false;

        return next();
    } catch (err: any) {
        console.log("Access token error:", err.message); // Add logging for debugging

        // Handle expired access token
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
                if (!decoded._id || !decoded.email) {
                    return next(
                        createHttpError(401, "Invalid refresh token payload")
                    );
                }

                const { isLogin, email, _id } = decoded;

                const _req = req as AuthRequest;
                _req._id = _id;
                _req.isLogin = isLogin || false;
                _req.email = email;
                _req.isAccessTokenExp = true;

                return next();
            } catch (error: any) {
                console.log("Refresh token error:", error.message); // Add logging
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

export default authenticate;
