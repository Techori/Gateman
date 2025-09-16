import type { Request, Response } from "express";
import { WalletAutoDebitService } from "./walletAutoDebitService.js";
import { config } from "../config/index.js";
import type { 
    CreateAutoDebitMandateRequest, 
    AutoDebitMandateAction 
} from "./walletTypes.js";

// Extended Request interface to include user information
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

export class WalletAutoDebitController {

    /**
     * Create auto-debit mandate
     */
    static async createMandate(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            const mandateData: CreateAutoDebitMandateRequest = req.body;

            // Basic validation
            if (!mandateData.serviceId || !mandateData.amount || !mandateData.frequency) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: serviceId, amount, frequency"
                });
            }

            if (mandateData.amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Amount must be greater than 0"
                });
            }

            if (mandateData.frequency === 'custom' && !mandateData.customFrequencyDays) {
                return res.status(400).json({
                    success: false,
                    message: "Custom frequency days required when frequency is custom"
                });
            }

            const result = await WalletAutoDebitService.createMandate(userId, mandateData);

            return res.status(result.success ? 201 : 400).json(result);

        } catch (error) {
            console.error('Error in createMandate:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Get user's auto-debit mandates
     */
    static async getUserMandates(req: AuthRequest, res: Response) {
        try {
            const userId = req.params.userId || req.user?.id;
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            // Check if user is accessing their own data or if admin
            if (req.user?.id !== userId && req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Cannot access other user's mandates"
                });
            }

            const mandates = await WalletAutoDebitService.getUserMandates(userId);

            return res.status(200).json({
                success: true,
                message: "Mandates retrieved successfully",
                data: {
                    mandates,
                    count: mandates.length
                }
            });

        } catch (error) {
            console.error('Error in getUserMandates:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Update mandate status (pause, resume, cancel)
     */
    static async updateMandateStatus(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            const mandateAction: AutoDebitMandateAction = req.body;

            if (!mandateAction.mandateId || !mandateAction.action) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: mandateId, action"
                });
            }

            if (!['pause', 'resume', 'cancel'].includes(mandateAction.action)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid action. Must be 'pause', 'resume', or 'cancel'"
                });
            }

            const result = await WalletAutoDebitService.updateMandateStatus(userId, mandateAction);

            return res.status(result.success ? 200 : 400).json(result);

        } catch (error) {
            console.error('Error in updateMandateStatus:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Pause auto-debit mandate
     */
    static async pauseMandate(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { mandateId } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            if (!mandateId) {
                return res.status(400).json({
                    success: false,
                    message: "Mandate ID is required"
                });
            }

            const result = await WalletAutoDebitService.updateMandateStatus(userId, {
                mandateId,
                action: 'pause'
            });

            return res.status(result.success ? 200 : 400).json(result);

        } catch (error) {
            console.error('Error in pauseMandate:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Resume auto-debit mandate
     */
    static async resumeMandate(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { mandateId } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            if (!mandateId) {
                return res.status(400).json({
                    success: false,
                    message: "Mandate ID is required"
                });
            }

            const result = await WalletAutoDebitService.updateMandateStatus(userId, {
                mandateId,
                action: 'resume'
            });

            return res.status(result.success ? 200 : 400).json(result);

        } catch (error) {
            console.error('Error in resumeMandate:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Cancel auto-debit mandate
     */
    static async cancelMandate(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { mandateId } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            if (!mandateId) {
                return res.status(400).json({
                    success: false,
                    message: "Mandate ID is required"
                });
            }

            const result = await WalletAutoDebitService.updateMandateStatus(userId, {
                mandateId,
                action: 'cancel'
            });

            return res.status(result.success ? 200 : 400).json(result);

        } catch (error) {
            console.error('Error in cancelMandate:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Get mandate logs (transaction history)
     */
    static async getMandateLogs(req: Request, res: Response) {
        try {
            const { mandateId } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;

            if (!mandateId) {
                return res.status(400).json({
                    success: false,
                    message: "Mandate ID is required"
                });
            }

            const logs = await WalletAutoDebitService.getMandateLogs(mandateId, limit);

            return res.status(200).json({
                success: true,
                message: "Mandate logs retrieved successfully",
                data: {
                    logs,
                    count: logs.length
                }
            });

        } catch (error) {
            console.error('Error in getMandateLogs:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * CRON endpoint to process due mandates
     */
    static async runAutoDebitCron(req: Request, res: Response) {
        try {
            // This endpoint should be protected and only accessible by system/admin
            const authHeader = req.headers.authorization;
            const expectedToken = config.CRON_SECRET_TOKEN;
            
            if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized: Invalid cron token"
                });
            }

            console.log('Running auto-debit cron job...');
            const result = await WalletAutoDebitService.processDueMandates();

            console.log('Auto-debit cron job completed:', result);

            return res.status(200).json({
                success: true,
                message: "Auto-debit processing completed",
                data: result
            });

        } catch (error) {
            console.error('Error in runAutoDebitCron:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    // Admin Controllers

    /**
     * Admin: Get all mandates with pagination
     */
    static async getAllMandates(req: AuthRequest, res: Response) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Admin access required"
                });
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const status = req.query.status as string;
            const userId = req.query.userId as string;

            const result = await WalletAutoDebitService.getAllMandates(page, limit, status, userId);

            return res.status(200).json({
                success: true,
                message: "Mandates retrieved successfully",
                data: result
            });

        } catch (error) {
            console.error('Error in getAllMandates:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Admin: Get auto-debit summary
     */
    static async getAdminSummary(req: AuthRequest, res: Response) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Admin access required"
                });
            }

            const summary = await WalletAutoDebitService.getAdminSummary();

            return res.status(200).json({
                success: true,
                message: "Admin summary retrieved successfully",
                data: summary
            });

        } catch (error) {
            console.error('Error in getAdminSummary:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Admin: Force run auto-debit for specific mandate
     */
    static async forceRunMandate(req: AuthRequest, res: Response) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Admin access required"
                });
            }

            const { mandateId } = req.body;
            const adminUserId = req.user.id;

            if (!mandateId) {
                return res.status(400).json({
                    success: false,
                    message: "Mandate ID is required"
                });
            }

            const result = await WalletAutoDebitService.forceRunMandate(mandateId, adminUserId);

            return res.status(result.success ? 200 : 400).json(result);

        } catch (error) {
            console.error('Error in forceRunMandate:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * Admin: Get all auto-debit logs
     */
    static async getAllLogs(req: AuthRequest, res: Response) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Admin access required"
                });
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const status = req.query.status as string;

            // For now, using the service method for mandate logs
            // You might want to create a dedicated admin service method for all logs
            return res.status(200).json({
                success: true,
                message: "Feature under development",
                data: {
                    message: "Use getMandateLogs for specific mandate logs"
                }
            });

        } catch (error) {
            console.error('Error in getAllLogs:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}
