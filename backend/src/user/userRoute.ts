import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import {
    createUser,
    loginUser,
    logoutUser,
    sendOtpToEmail,
    verifyEmail,
    logoutAllDevices,
    getActiveSessions,
    logoutSpecificSession,
    forecedLogoutAllDevices,
    getActiveSessionsCount,
    checkUserHasActiveSessions,
    getDetailedSessionInfo,
    validateSessionById,
    getAllActiveSessionsAdmin,
    getSessionStatisticsAdmin,
    changePassword,
    forgotPasswordSendOtp,
    resetPasswordWithOtp,
    changePasswordAndLogoutOthers,
    createEmployee,
    logoutUserBySessionId,
    getUserProfile,
} from "./userController.js";

const userRouter = express.Router();

// Authentication routes
userRouter.post("/register", createUser);
userRouter.post("/login", loginUser);
// user profile route
userRouter.get("/userProfile", authenticate, getUserProfile);

// Protected routes - require authentication
// user logout by userId (by token)
userRouter.post("/logout", authenticate, logoutUser);
userRouter.post("/logout-all", authenticate, logoutAllDevices);
userRouter.post("/logout-specific", authenticate, logoutSpecificSession);

// Email verification routes
userRouter.post("/sendOtp", authenticate, sendOtpToEmail);
userRouter.post("/verifyEmail", authenticate, verifyEmail);

// Session management routes
userRouter.get("/sessions", authenticate, getActiveSessions);
userRouter.get("/sessions/count", authenticate, getActiveSessionsCount);
userRouter.get("/sessions/check", authenticate, checkUserHasActiveSessions);
userRouter.get(
    "/sessions/:targetSessionId",
    authenticate,
    getDetailedSessionInfo
);
userRouter.get(
    "/sessions/validate/:sessionId",
    authenticate,
    validateSessionById
);

// Admin routes - require authentication and admin role (role check is done in controller)
userRouter.get("/admin/sessions/all", authenticate, getAllActiveSessionsAdmin);
userRouter.get(
    "/admin/sessions/statistics",
    authenticate,
    getSessionStatisticsAdmin
);

// Password management routes
userRouter.put("/change-password", authenticate, changePassword);
userRouter.put(
    "/change-password-logout-others",
    authenticate,
    changePasswordAndLogoutOthers
);

// Forgot password routes (no authentication required)
userRouter.post("/forgot-password/send-otp", forgotPasswordSendOtp);
userRouter.post("/forgot-password/reset", resetPasswordWithOtp);

// Force logout route (can be used by admin or for password reset scenarios)
userRouter.post("/force-logout", forecedLogoutAllDevices); // Note: This one doesn't require auth as it's for emergency situations

// user logout by userid and sessionId
userRouter.post('/logoutUserBySessionId', logoutUserBySessionId)




// route for create employee for property owerner role
userRouter.post("/createEmployee", authenticate, createEmployee);

export default userRouter;
