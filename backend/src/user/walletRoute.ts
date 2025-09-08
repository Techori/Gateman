import express from "express";
import { 
    getWalletDetails, 
    initiateWalletTopup, 
    handleTopupSuccess, 
    handleTopupFailure,
    getTransactionHistory,
    processServicePayment,
    canPayFromWallet,
    requestRefund,
    // Admin functions
    getAllWallets,
    getAllTransactions,
    updateWalletStatus,
    adjustWalletBalance,
    getWalletSummary
} from "./walletController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// User wallet routes (authentication required)
// Get wallet details and balance
router.get("/", authMiddleware, getWalletDetails);

// Get transaction history
router.get("/transactions", authMiddleware, getTransactionHistory);

// Check if payment can be made from wallet
router.get("/can-pay", authMiddleware, canPayFromWallet);

// Initiate wallet topup
router.post("/topup", authMiddleware, initiateWalletTopup);

// Process service payment from wallet
router.post("/pay", authMiddleware, processServicePayment);

// Request refund to wallet
router.post("/refund", authMiddleware, requestRefund);

// Payment gateway callbacks (no authentication needed)
// Handle topup success callback (from payment gateway)
router.post("/topup/success", handleTopupSuccess);

// Handle topup failure callback (from payment gateway)
router.post("/topup/failure", handleTopupFailure);

// Admin routes (authentication + admin role required)
// Get all wallets overview
router.get("/admin/wallets", authMiddleware, getAllWallets);

// Get all transactions across all wallets
router.get("/admin/transactions", authMiddleware, getAllTransactions);

// Get wallet dashboard summary/statistics
router.get("/admin/summary", authMiddleware, getWalletSummary);

// Update wallet status (block/unblock)
router.put("/admin/wallets/:walletId/status", authMiddleware, updateWalletStatus);

// Admin balance adjustment
router.post("/admin/wallets/:walletId/adjust", authMiddleware, adjustWalletBalance);

export default router;
