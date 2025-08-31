import express from "express";
import { 
    getWalletDetails, 
    initiateWalletTopup, 
    handleTopupSuccess, 
    handleTopupFailure,
    getTransactionHistory 
} from "./walletController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Get wallet details and balance
router.get("/", authMiddleware, getWalletDetails);

// Get transaction history
router.get("/transactions", authMiddleware, getTransactionHistory);

// Initiate wallet topup
router.post("/topup", authMiddleware, initiateWalletTopup);

// Handle topup success callback (from payment gateway)
router.post("/topup/success", handleTopupSuccess);

// Handle topup failure callback (from payment gateway)
router.post("/topup/failure", handleTopupFailure);

export default router;
