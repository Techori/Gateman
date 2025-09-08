import express from "express";
import {
    getAllServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    getAllCashbackRules,
    createCashbackRule,
    updateCashbackRule,
    deleteCashbackRule
} from "./serviceController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Service management routes
// Get all services (public)
router.get("/", getAllServices);

// Get service by ID (public)
router.get("/:serviceId", getServiceById);

// Admin service management routes (authentication + admin role required)
// Create new service
router.post("/", authMiddleware, createService);

// Update service
router.put("/:serviceId", authMiddleware, updateService);

// Delete service
router.delete("/:serviceId", authMiddleware, deleteService);

// Cashback rules management routes (admin only)
// Get all cashback rules
router.get("/admin/cashback-rules", authMiddleware, getAllCashbackRules);

// Create cashback rule
router.post("/admin/cashback-rules", authMiddleware, createCashbackRule);

// Update cashback rule
router.put("/admin/cashback-rules/:ruleId", authMiddleware, updateCashbackRule);

// Delete cashback rule
router.delete("/admin/cashback-rules/:ruleId", authMiddleware, deleteCashbackRule);

export default router;
