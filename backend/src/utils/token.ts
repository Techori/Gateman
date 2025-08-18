import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

// Generate accessToken
const generateAccessToken = (payload: object): string => {
    console.log("access token payload:", payload);
    const secretKey = config.JWT_ACCESS_KEY;

    if (!secretKey || typeof secretKey !== "string") {
        throw new Error("JWT_ACCESS_KEY is not defined in config");
    }

    const options: jwt.SignOptions = {
        algorithm: "HS256",
        expiresIn: "15m",
        issuer: config.JWT_ISSUER || "default_issuer",
        audience: config.JWT_AUDIENCE || "default_audience",
    };

    const token = jwt.sign(payload, secretKey, options);
    return token;
};

// Generate RefreshToken
const generateRefreshToken = (payload: object): string => {
    console.log("refresh token payload:", payload);
    const secretKey = config.JWT_REFRESH_KEY;

    if (!secretKey || typeof secretKey !== "string") {
        throw new Error("JWT_REFRESH_KEY is not defined in config");
    }

    const options: jwt.SignOptions = {
        algorithm: "HS256",
        expiresIn: "7d",
        issuer: config.JWT_ISSUER || "default_issuer",
        audience: config.JWT_AUDIENCE || "default_audience",
    };

    const token = jwt.sign(payload, secretKey, options);
    return token;
};

export { generateAccessToken, generateRefreshToken };
