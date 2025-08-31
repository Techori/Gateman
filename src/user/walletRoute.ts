import express from "express";
import { 
    getWalletDetails, 
    initiateWalletTopup, 
    handleTopupSuccess, 
    handleTopupFailure,
    getTransactionHistory,
    handleCashfreeTopupWebhook,
    verifyCashfreeTopupPayment
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

// Cashfree specific endpoints for wallet topup
router.post("/topup/cashfree/webhook", handleCashfreeTopupWebhook);
router.post("/topup/cashfree/verify", authMiddleware, verifyCashfreeTopupPayment);

export default router;
