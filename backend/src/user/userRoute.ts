import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import { fileURLToPath } from "node:url";
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
    uploadUserProfileImage,
    getAllEmployeesForPropertyOwner,
    updateEmployeeDetails,
    deleteEmployeeById,
    forceLogoutEmployeeById,
    // test,
} from "./userController.js";
import path from "node:path";
import multer from "multer";

const userRouter = express.Router();
// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const upload = multer({
    dest: path.resolve(process.cwd(), "public/data/uploads"),
    limits: {
        fileSize: 4 * 1024 * 1024, // 4MB per file
        files: 1 // Maximum 1 file
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});
// userRouter.get("/test", authenticate, test);

// Authentication routes
userRouter.post("/register", createUser);
userRouter.post("/login", loginUser);
// user profile route
userRouter.get("/userProfile", authenticate, getUserProfile);

userRouter.post(
    "/uploadUserProfileImage",
    authenticate,
    upload.fields([{ name: "userProfileImage", maxCount: 1 }]),
    uploadUserProfileImage
);

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
// Update employee details (name, phone, email)
userRouter.put("/employee/:employeeId/update-details", authenticate, updateEmployeeDetails);

// Delete employee by ID
userRouter.delete("/employee/:employeeId/delete", authenticate, deleteEmployeeById);

// Force logout employee from all devices
userRouter.post("/employee/:employeeId/force-logout", authenticate, forceLogoutEmployeeById);

// Forgot password routes (no authentication required)
userRouter.post("/forgot-password/send-otp", forgotPasswordSendOtp);
userRouter.post("/forgot-password/reset", resetPasswordWithOtp);

// Force logout route (can be used by admin or for password reset scenarios)
userRouter.post("/force-logout", forecedLogoutAllDevices); // Note: This one doesn't require auth as it's for emergency situations

// user logout by userid and sessionId
userRouter.post('/logoutUserBySessionId', logoutUserBySessionId)





// route for create employee for property owerner role
userRouter.post("/createEmployee", authenticate, createEmployee);
userRouter.get("/getAllEmployees", authenticate, getAllEmployeesForPropertyOwner);



// Additional routes for updating, deleting, and managing employees can be added here
export default userRouter;
