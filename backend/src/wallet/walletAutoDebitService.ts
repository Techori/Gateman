import { WalletAutoDebitMandateModel, WalletAutoDebitLogModel } from "./walletAutoDebitModel.js";
import { WalletModel } from "./walletModel.js";
import { ServiceModel } from "../user/serviceModel.js";
import type { 
    CreateAutoDebitMandateRequest, 
    AutoDebitResponse, 
    WalletAutoDebitMandate,
    WalletAutoDebitLog,
    AutoDebitMandateAction,
    AdminAutoDebitSummary
} from "./walletTypes.js";

export class WalletAutoDebitService {
    
    /**
     * Create a new auto-debit mandate
     */
    static async createMandate(
        userId: string, 
        mandateData: CreateAutoDebitMandateRequest
    ): Promise<AutoDebitResponse> {
        try {
            // Validate service exists
            const service = await ServiceModel.findById(mandateData.serviceId);
            if (!service || !service.isActive) {
                return {
                    success: false,
                    message: "Service not found or inactive"
                };
            }

            // Validate user wallet exists and is active
            const wallet = await WalletModel.findOne({ userId, status: 'active' });
            if (!wallet) {
                return {
                    success: false,
                    message: "Active wallet not found for user"
                };
            }

            // Check if user already has an active mandate for this service
            const existingMandate = await WalletAutoDebitMandateModel.findOne({
                userId,
                serviceId: mandateData.serviceId,
                status: { $in: ['active', 'paused'] }
            });

            if (existingMandate) {
                return {
                    success: false,
                    message: "Active mandate already exists for this service"
                };
            }

            // Validate amount
            if (mandateData.amount <= 0 || mandateData.amount > (mandateData.maxAmount || Number.MAX_SAFE_INTEGER)) {
                return {
                    success: false,
                    message: "Invalid amount specified"
                };
            }

            // Calculate next due date
            const startDate = mandateData.startDate || new Date();
            const nextDueDate = this.calculateInitialDueDate(startDate, mandateData.frequency, mandateData.customFrequencyDays);

            // Create mandate
            const mandate = new WalletAutoDebitMandateModel({
                userId,
                serviceId: mandateData.serviceId,
                amount: mandateData.amount,
                frequency: mandateData.frequency,
                customFrequencyDays: mandateData.customFrequencyDays,
                nextDueDate,
                authorizationMethod: mandateData.authorizationMethod,
                authorizationToken: mandateData.authorizationToken,
                maxAmount: mandateData.maxAmount,
                status: 'active',
                failureRetryCount: 0,
                maxRetryCount: 3
            });

            await mandate.save();

            // Log the mandate creation
            await this.logAutoDebitActivity(
                mandate._id.toString(),
                new Date(),
                mandate.amount,
                'pending',
                0,
                undefined,
                undefined,
                false,
                userId
            );

            return {
                success: true,
                message: "Auto-debit mandate created successfully",
                data: {
                    mandateId: mandate._id.toString(),
                    nextDueDate: mandate.nextDueDate,
                    amount: mandate.amount,
                    frequency: mandate.frequency
                }
            };

        } catch (error) {
            console.error('Error creating auto-debit mandate:', error);
            return {
                success: false,
                message: "Failed to create auto-debit mandate"
            };
        }
    }

    /**
     * Get all mandates for a user
     */
    static async getUserMandates(userId: string): Promise<WalletAutoDebitMandate[]> {
        try {
            const mandates = await WalletAutoDebitMandateModel
                .find({ userId })
                .populate('serviceId')
                .sort({ createdAt: -1 });

            return mandates;
        } catch (error) {
            console.error('Error fetching user mandates:', error);
            return [];
        }
    }

    /**
     * Update mandate status (pause, resume, cancel)
     */
    static async updateMandateStatus(
        userId: string, 
        mandateAction: AutoDebitMandateAction
    ): Promise<AutoDebitResponse> {
        try {
            const mandate = await WalletAutoDebitMandateModel.findOne({
                _id: mandateAction.mandateId,
                userId
            });

            if (!mandate) {
                return {
                    success: false,
                    message: "Mandate not found"
                };
            }

            switch (mandateAction.action) {
                case 'pause':
                    mandate.pause();
                    break;
                case 'resume':
                    mandate.resume();
                    break;
                case 'cancel':
                    mandate.cancel();
                    break;
                default:
                    return {
                        success: false,
                        message: "Invalid action"
                    };
            }

            await mandate.save();

            return {
                success: true,
                message: `Mandate ${mandateAction.action}d successfully`
            };

        } catch (error) {
            console.error('Error updating mandate status:', error);
            return {
                success: false,
                message: "Failed to update mandate status"
            };
        }
    }

    /**
     * Process auto-debit for due mandates (called by cron job)
     */
    static async processDueMandates(): Promise<{
        processed: number;
        successful: number;
        failed: number;
        details: Array<{mandateId: string; status: string; reason?: string}>
    }> {
        try {
            const now = new Date();
            
            // Find all active mandates that are due
            const dueMandates = await WalletAutoDebitMandateModel
                .find({
                    status: 'active',
                    nextDueDate: { $lte: now },
                    failureRetryCount: { $lt: 3 }
                })
                .populate('serviceId');

            const results = {
                processed: 0,
                successful: 0,
                failed: 0,
                details: [] as Array<{mandateId: string; status: string; reason?: string}>
            };

            for (const mandate of dueMandates) {
                results.processed++;
                
                const debitResult = await this.processMandate(mandate);
                
                if (debitResult.success) {
                    results.successful++;
                    results.details.push({
                        mandateId: mandate._id.toString(),
                        status: 'success'
                    });
                } else {
                    results.failed++;
                    results.details.push({
                        mandateId: mandate._id.toString(),
                        status: 'failed',
                        reason: debitResult.reason || 'Unknown error'
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('Error processing due mandates:', error);
            return {
                processed: 0,
                successful: 0,
                failed: 0,
                details: []
            };
        }
    }

    /**
     * Process individual mandate
     */
    static async processMandate(mandate: WalletAutoDebitMandate): Promise<{
        success: boolean;
        reason?: string;
        transactionId?: string;
    }> {
        try {
            // Get user wallet
            const wallet = await WalletModel.findOne({ 
                userId: mandate.userId, 
                status: 'active' 
            });

            if (!wallet) {
                await this.logAutoDebitActivity(
                    mandate._id.toString(),
                    new Date(),
                    mandate.amount,
                    'failed',
                    mandate.failureRetryCount + 1,
                    'Wallet not found or inactive'
                );
                
                mandate.incrementRetryCount();
                await mandate.save();
                
                return {
                    success: false,
                    reason: 'Wallet not found or inactive'
                };
            }

            // Check sufficient balance
            if (!wallet.hasSufficientBalance(mandate.amount)) {
                await this.logAutoDebitActivity(
                    mandate._id.toString(),
                    new Date(),
                    mandate.amount,
                    'failed',
                    mandate.failureRetryCount + 1,
                    'Insufficient balance'
                );
                
                mandate.incrementRetryCount();
                await mandate.save();
                
                return {
                    success: false,
                    reason: 'Insufficient balance'
                };
            }

            // Debit amount from wallet
            const transaction = wallet.debitAmount(
                mandate.amount,
                `Auto-debit for ${mandate.serviceId}`,
                mandate.serviceId,
                undefined,
                `AUTODEBIT_${mandate._id}_${Date.now()}`
            );

            await wallet.save();

            // Log successful debit
            await this.logAutoDebitActivity(
                mandate._id.toString(),
                new Date(),
                mandate.amount,
                'success',
                0,
                undefined,
                transaction._id?.toString()
            );

            // Update mandate for next cycle
            mandate.resetRetryCount();
            mandate.nextDueDate = mandate.calculateNextDueDate();
            await mandate.save();

            // TODO: Send notification to user about successful debit
            // await NotificationService.sendAutoDebitSuccess(mandate.userId, mandate.amount);

            return {
                success: true,
                ...(transaction._id && { transactionId: transaction._id.toString() })
            };

        } catch (error) {
            console.error('Error processing mandate:', error);
            
            await this.logAutoDebitActivity(
                mandate._id.toString(),
                new Date(),
                mandate.amount,
                'failed',
                mandate.failureRetryCount + 1,
                error instanceof Error ? error.message : 'Unknown error'
            );
            
            mandate.incrementRetryCount();
            await mandate.save();
            
            return {
                success: false,
                reason: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get auto-debit logs for a mandate
     */
    static async getMandateLogs(mandateId: string, limit = 50): Promise<WalletAutoDebitLog[]> {
        try {
            const logs = await WalletAutoDebitLogModel
                .find({ mandateId })
                .sort({ createdAt: -1 })
                .limit(limit);

            return logs;
        } catch (error) {
            console.error('Error fetching mandate logs:', error);
            return [];
        }
    }

    /**
     * Admin: Get all mandates with pagination
     */
    static async getAllMandates(
        page = 1, 
        limit = 20, 
        status?: string,
        userId?: string
    ): Promise<{
        mandates: WalletAutoDebitMandate[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const query: any = {};
            
            if (status) {
                query.status = status;
            }
            
            if (userId) {
                query.userId = userId;
            }

            const skip = (page - 1) * limit;
            
            const mandates = await WalletAutoDebitMandateModel
                .find(query)
                .populate('userId', 'name email')
                .populate('serviceId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await WalletAutoDebitMandateModel.countDocuments(query);

            return {
                mandates,
                total,
                page,
                limit
            };

        } catch (error) {
            console.error('Error fetching all mandates:', error);
            return {
                mandates: [],
                total: 0,
                page,
                limit
            };
        }
    }

    /**
     * Admin: Get auto-debit summary
     */
    static async getAdminSummary(): Promise<AdminAutoDebitSummary> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const [
                totalActiveMandates,
                totalPausedMandates,
                totalCancelledMandates,
                todayLogs,
                recentLogs,
                pendingRetries
            ] = await Promise.all([
                WalletAutoDebitMandateModel.countDocuments({ status: 'active' }),
                WalletAutoDebitMandateModel.countDocuments({ status: 'paused' }),
                WalletAutoDebitMandateModel.countDocuments({ status: 'cancelled' }),
                WalletAutoDebitLogModel.find({
                    debitDate: { $gte: today, $lt: tomorrow }
                }),
                WalletAutoDebitLogModel.find({})
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate('mandateId'),
                WalletAutoDebitMandateModel.countDocuments({
                    status: 'active',
                    failureRetryCount: { $gt: 0, $lt: 3 }
                })
            ]);

            const todaySuccessfulDebits = todayLogs.filter(log => log.status === 'success').length;
            const todayFailedDebits = todayLogs.filter(log => log.status === 'failed').length;

            return {
                totalActiveMandates,
                totalPausedMandates,
                totalCancelledMandates,
                todaySuccessfulDebits,
                todayFailedDebits,
                recentLogs,
                pendingRetries
            };

        } catch (error) {
            console.error('Error fetching admin summary:', error);
            return {
                totalActiveMandates: 0,
                totalPausedMandates: 0,
                totalCancelledMandates: 0,
                todaySuccessfulDebits: 0,
                todayFailedDebits: 0,
                recentLogs: [],
                pendingRetries: 0
            };
        }
    }

    /**
     * Admin: Force run auto-debit for specific mandate
     */
    static async forceRunMandate(
        mandateId: string, 
        adminUserId: string
    ): Promise<AutoDebitResponse> {
        try {
            const mandate = await WalletAutoDebitMandateModel.findById(mandateId);
            
            if (!mandate) {
                return {
                    success: false,
                    message: "Mandate not found"
                };
            }

            const result = await this.processMandate(mandate);
            
            // Log admin action
            await this.logAutoDebitActivity(
                mandateId,
                new Date(),
                mandate.amount,
                result.success ? 'success' : 'failed',
                0,
                result.reason,
                result.transactionId,
                false,
                adminUserId
            );

            return {
                success: result.success,
                message: result.success 
                    ? "Auto-debit processed successfully" 
                    : `Auto-debit failed: ${result.reason}`
            };

        } catch (error) {
            console.error('Error force running mandate:', error);
            return {
                success: false,
                message: "Failed to process auto-debit"
            };
        }
    }

    /**
     * Helper: Log auto-debit activity
     */
    private static async logAutoDebitActivity(
        mandateId: string,
        debitDate: Date,
        amount: number,
        status: 'success' | 'failed' | 'pending' | 'retry',
        retryCount: number,
        failureReason?: string,
        transactionId?: string,
        systemTriggered = true,
        triggeredBy?: string
    ): Promise<void> {
        try {
            const log = new WalletAutoDebitLogModel({
                mandateId,
                debitDate,
                amount,
                status,
                retryCount,
                failureReason,
                transactionId,
                systemTriggered,
                triggeredBy
            });

            await log.save();
        } catch (error) {
            console.error('Error logging auto-debit activity:', error);
        }
    }

    /**
     * Helper: Calculate initial due date based on frequency
     */
    private static calculateInitialDueDate(
        startDate: Date, 
        frequency: string, 
        customFrequencyDays?: number
    ): Date {
        const dueDate = new Date(startDate);
        
        switch (frequency) {
            case 'daily':
                dueDate.setDate(dueDate.getDate() + 1);
                break;
            case 'weekly':
                dueDate.setDate(dueDate.getDate() + 7);
                break;
            case 'monthly':
                dueDate.setMonth(dueDate.getMonth() + 1);
                break;
            case 'quarterly':
                dueDate.setMonth(dueDate.getMonth() + 3);
                break;
            case 'yearly':
                dueDate.setFullYear(dueDate.getFullYear() + 1);
                break;
            case 'custom':
                if (customFrequencyDays) {
                    dueDate.setDate(dueDate.getDate() + customFrequencyDays);
                }
                break;
        }
        
        return dueDate;
    }

    /**
     * Get mandates that need notification (24 hours before due)
     */
    static async getMandatesForPreNotification(): Promise<WalletAutoDebitMandate[]> {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            const mandates = await WalletAutoDebitMandateModel
                .find({
                    status: 'active',
                    nextDueDate: { $gte: tomorrow, $lt: dayAfterTomorrow },
                    graceLastNotified: { $ne: tomorrow } // Avoid duplicate notifications
                })
                .populate('userId', 'name email')
                .populate('serviceId');

            return mandates;
        } catch (error) {
            console.error('Error fetching mandates for pre-notification:', error);
            return [];
        }
    }
}
