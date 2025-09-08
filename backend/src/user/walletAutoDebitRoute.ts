import { Router } from "express";
import { WalletAutoDebitController } from "./walletAutoDebitController.js";
import authenticate from "../middleware/authMiddleware.js";

const walletAutoDebitRouter = Router();

// User Routes (requires authentication)
walletAutoDebitRouter.post("/create", authenticate, WalletAutoDebitController.createMandate);
walletAutoDebitRouter.get("/:userId", authenticate, WalletAutoDebitController.getUserMandates);
walletAutoDebitRouter.post("/update-status", authenticate, WalletAutoDebitController.updateMandateStatus);
walletAutoDebitRouter.post("/pause", authenticate, WalletAutoDebitController.pauseMandate);
walletAutoDebitRouter.post("/resume", authenticate, WalletAutoDebitController.resumeMandate);
walletAutoDebitRouter.post("/cancel", authenticate, WalletAutoDebitController.cancelMandate);
walletAutoDebitRouter.get("/logs/:mandateId", authenticate, WalletAutoDebitController.getMandateLogs);

// System Routes (for cron jobs)
walletAutoDebitRouter.post("/run", WalletAutoDebitController.runAutoDebitCron);

// Admin Routes (requires admin authentication)
walletAutoDebitRouter.get("/admin/mandates", authenticate, WalletAutoDebitController.getAllMandates);
walletAutoDebitRouter.get("/admin/summary", authenticate, WalletAutoDebitController.getAdminSummary);
walletAutoDebitRouter.post("/admin/force-run", authenticate, WalletAutoDebitController.forceRunMandate);
walletAutoDebitRouter.get("/admin/logs", authenticate, WalletAutoDebitController.getAllLogs);

export { walletAutoDebitRouter };
