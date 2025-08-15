import { config as conf } from "dotenv";
conf();

// Helper function to ensure required environment variables exist
const getRequiredEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
};

// Helper function for optional environment variables with defaults
const getOptionalEnv = (key: string, defaultValue: string): string => {
    return process.env[key] || defaultValue;
};

const _config = {
    port: getOptionalEnv("PORT", "3000"),
    databaseUrl: getRequiredEnv("MONGO_CONNECTION_STRING"),
    env: getOptionalEnv("NODE_ENV", "development"),

    // JWT Configuration - all required for security
    JWT_ACCESS_KEY: getRequiredEnv("JWT_ACCESS_KEY"),
    JWT_REFRESH_KEY: getRequiredEnv("JWT_REFRESH_KEY"),
    JWT_ACCESS_EXP: getOptionalEnv("JWT_ACCESS_EXP", "15m"),
    JWT_REFRESH_EXP: getOptionalEnv("JWT_REFRESH_EXP", "7d"),
    JWT_ISSUER: getOptionalEnv("JWT_ISSUER", "your-app-name"),
    JWT_AUDIENCE: getOptionalEnv("JWT_AUDIENCE", "your-app-users"),

    frontendDomain: getOptionalEnv("FRONTEND_DOMAIN", "http://localhost:3000"),
} as const;

export const config = Object.freeze(_config);

// Type for the config object
export type Config = typeof config;
