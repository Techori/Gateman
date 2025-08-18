import express, {
    type Request,
    type Response,
    type NextFunction,
} from "express";
import cors from "cors";
import globalErrorHandler from "./middleware/globalErrorHandler.js";
import hpp from "hpp";
import helmet from "helmet";
import { config } from "./config/index.js";
import userRouter from "./user/userRoute.js";

const app = express();

const allowedOrigins = [
    config.frontendDomain,
    config.adminDashboardDomain,
    config.userDashboardDomain,
];
const corsOptions = {
    origin: function (origin: any, callback: any) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// security middleware
app.use(helmet());
app.use(hpp());

// Routes url
app.get("/", (req, res, next) => {
    res.status(200).json({
        success: true,
        message: "App is running and work fine!",
    });
});

app.use("/api/v1/users", userRouter);

// Global error handler
app.use(globalErrorHandler);

export default app;
