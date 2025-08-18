import type { Request, Response, NextFunction } from "express";

import { HttpError } from "http-errors";
import { config } from "../config/index.js";

function globalErrorHandler(
    err: HttpError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message,
        errorStack: config.env === "developmet" ? err.stack : "",
    });
}

export default globalErrorHandler;
