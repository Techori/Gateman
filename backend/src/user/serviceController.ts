import type { Request, Response, NextFunction } from "express";
import { ServiceModel } from "./serviceModel.js";
import { WalletCashbackRuleModel } from "./cashbackRuleModel.js";

// Get all services
export const getAllServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { isActive, vendorId } = req.query;
        
        const filter: any = {};
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }
        if (vendorId) {
            filter.vendorId = vendorId;
        }

        const services = await ServiceModel.find(filter)
            .populate('vendorId', 'name email')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            message: "Services fetched successfully",
            data: {
                services,
                total: services.length
            }
        });
    } catch (error) {
        console.error("Get all services error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch services",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Get service by ID
export const getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serviceId } = req.params;

        const service = await ServiceModel.findById(serviceId)
            .populate('vendorId', 'name email');

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Service fetched successfully",
            data: { service }
        });
    } catch (error) {
        console.error("Get service by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch service",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Create new service (admin only)
export const createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { name, price, vendorId, description } = req.body;

        // Validation
        if (!name || !price) {
            return res.status(400).json({
                success: false,
                message: "Service name and price are required"
            });
        }

        if (price < 0) {
            return res.status(400).json({
                success: false,
                message: "Price cannot be negative"
            });
        }

        // Check if vendor exists if provided
        if (vendorId) {
            const { User } = await import("./userModel.js");
            const vendor = await User.findById(vendorId);
            if (!vendor) {
                return res.status(404).json({
                    success: false,
                    message: "Vendor not found"
                });
            }
        }

        const service = await ServiceModel.create({
            name,
            price,
            vendorId,
            description,
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: "Service created successfully",
            data: { service }
        });
    } catch (error) {
        console.error("Create service error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create service",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Update service (admin only)
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { serviceId } = req.params;
        const { name, price, vendorId, description, isActive } = req.body;

        const service = await ServiceModel.findById(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        // Update fields if provided
        if (name !== undefined) service.name = name;
        if (price !== undefined) {
            if (price < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price cannot be negative"
                });
            }
            service.price = price;
        }
        if (vendorId !== undefined) service.vendorId = vendorId;
        if (description !== undefined) service.description = description;
        if (isActive !== undefined) service.isActive = isActive;

        await service.save();

        res.status(200).json({
            success: true,
            message: "Service updated successfully",
            data: { service }
        });
    } catch (error) {
        console.error("Update service error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update service",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Delete service (admin only)
export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { serviceId } = req.params;

        const service = await ServiceModel.findByIdAndDelete(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Service deleted successfully",
            data: { deletedService: service }
        });
    } catch (error) {
        console.error("Delete service error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete service",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// CASHBACK RULES MANAGEMENT

// Get all cashback rules
export const getAllCashbackRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { status, serviceType } = req.query;
        
        const filter: any = {};
        if (status) filter.status = status;
        if (serviceType) filter.serviceType = serviceType;

        const rules = await WalletCashbackRuleModel.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Cashback rules fetched successfully",
            data: {
                rules,
                total: rules.length
            }
        });
    } catch (error) {
        console.error("Get all cashback rules error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cashback rules",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Create cashback rule (admin only)
export const createCashbackRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { 
            minAmount, 
            cashbackAmount, 
            cashbackType, 
            maxCashback,
            serviceType,
            validFrom,
            validTo,
            description,
            usageLimit
        } = req.body;

        // Validation
        if (!minAmount || !cashbackAmount || !cashbackType || !validTo || !description) {
            return res.status(400).json({
                success: false,
                message: "Minimum amount, cashback amount, cashback type, valid to date, and description are required"
            });
        }

        if (cashbackType === 'percentage' && !maxCashback) {
            return res.status(400).json({
                success: false,
                message: "Max cashback is required for percentage type cashback"
            });
        }

        const rule = await WalletCashbackRuleModel.create({
            minAmount,
            cashbackAmount,
            cashbackType,
            maxCashback,
            serviceType: serviceType || 'All',
            validFrom: validFrom || new Date(),
            validTo: new Date(validTo),
            description,
            usageLimit,
            status: 'active'
        });

        res.status(201).json({
            success: true,
            message: "Cashback rule created successfully",
            data: { rule }
        });
    } catch (error) {
        console.error("Create cashback rule error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create cashback rule",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Update cashback rule (admin only)
export const updateCashbackRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { ruleId } = req.params;
        const updates = req.body;

        const rule = await WalletCashbackRuleModel.findById(ruleId);
        if (!rule) {
            return res.status(404).json({
                success: false,
                message: "Cashback rule not found"
            });
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                (rule as any)[key] = updates[key];
            }
        });

        await rule.save();

        res.status(200).json({
            success: true,
            message: "Cashback rule updated successfully",
            data: { rule }
        });
    } catch (error) {
        console.error("Update cashback rule error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cashback rule",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Delete cashback rule (admin only)
export const deleteCashbackRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { ruleId } = req.params;

        const rule = await WalletCashbackRuleModel.findByIdAndDelete(ruleId);
        if (!rule) {
            return res.status(404).json({
                success: false,
                message: "Cashback rule not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Cashback rule deleted successfully",
            data: { deletedRule: rule }
        });
    } catch (error) {
        console.error("Delete cashback rule error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete cashback rule",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
