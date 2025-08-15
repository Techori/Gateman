import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import {
    createUser,
    loginUser,
    logoutUser,
    sendOtpToEmail,
    verifyEmail,
} from "./userController.js";

const userRouter = express.Router();

userRouter.post("/register", createUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", authenticate, logoutUser);
userRouter.post("/sendOtp", authenticate, sendOtpToEmail);
userRouter.post("/verifyEmail", authenticate, verifyEmail);

export default userRouter;
