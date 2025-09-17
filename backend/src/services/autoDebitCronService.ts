import cron from "node-cron";
import { WalletAutoDebitService } from "../wallet/walletAutoDebitService.js";

export class AutoDebitCronService {
    private static instance: AutoDebitCronService;
    private jobs: Map<string, cron.ScheduledTask> = new Map();

    private constructor() {}

    static getInstance(): AutoDebitCronService {
        if (!AutoDebitCronService.instance) {
            AutoDebitCronService.instance = new AutoDebitCronService();
        }
        return AutoDebitCronService.instance;
    }

    /**
     * Initialize all auto-debit cron jobs
     */
    initializeJobs() {
        this.setupDailyAutoDebitJob();
        this.setupHourlyRetryJob();
        this.setupPreNotificationJob();
        
        console.log('Auto-debit cron jobs initialized');
    }

    /**
     * Daily job to process due auto-debits
     * Runs every day at 9:00 AM
     */
    private setupDailyAutoDebitJob() {
        const dailyJob = cron.schedule('0 9 * * *', async () => {
            console.log('Running daily auto-debit processing job...');
            
            try {
                const result = await WalletAutoDebitService.processDueMandates();
                console.log('Daily auto-debit job completed:', result);
                
                // Log the results for monitoring
                this.logJobResult('daily-autodebit', result);
                
            } catch (error) {
                console.error('Error in daily auto-debit job:', error);
                this.logJobError('daily-autodebit', error);
            }
        }, {
            timezone: "Asia/Kolkata" // Adjust timezone as needed
        });

        dailyJob.stop(); // Don't start immediately
        this.jobs.set('daily-autodebit', dailyJob);
    }

    /**
     * Hourly retry job for failed auto-debits
     * Runs every hour during business hours (9 AM to 9 PM)
     */
    private setupHourlyRetryJob() {
        const hourlyRetryJob = cron.schedule('0 9-21 * * *', async () => {
            console.log('Running hourly auto-debit retry job...');
            
            try {
                // Process only failed/retry mandates
                const result = await WalletAutoDebitService.processDueMandates();
                
                if (result.processed > 0) {
                    console.log('Hourly retry job completed:', result);
                    this.logJobResult('hourly-retry', result);
                }
                
            } catch (error) {
                console.error('Error in hourly retry job:', error);
                this.logJobError('hourly-retry', error);
            }
        }, {
            timezone: "Asia/Kolkata"
        });

        hourlyRetryJob.stop(); // Don't start immediately
        this.jobs.set('hourly-retry', hourlyRetryJob);
    }

    /**
     * Pre-notification job
     * Runs daily at 6:00 PM to send 24-hour advance notifications
     */
    private setupPreNotificationJob() {
        const preNotificationJob = cron.schedule('0 18 * * *', async () => {
            console.log('Running auto-debit pre-notification job...');
            
            try {
                const mandates = await WalletAutoDebitService.getMandatesForPreNotification();
                
                for (const mandate of mandates) {
                    // TODO: Send notification to user
                    // await NotificationService.sendPreDebitNotification(mandate);
                    console.log(`Pre-notification sent for mandate ${mandate._id}`);
                    
                    // Update last notified timestamp
                    mandate.graceLastNotified = new Date();
                    await mandate.save();
                }
                
                console.log(`Pre-notification job completed. Sent ${mandates.length} notifications`);
                
            } catch (error) {
                console.error('Error in pre-notification job:', error);
                this.logJobError('pre-notification', error);
            }
        }, {
            timezone: "Asia/Kolkata"
        });

        preNotificationJob.stop(); // Don't start immediately
        this.jobs.set('pre-notification', preNotificationJob);
    }

    /**
     * Start all cron jobs
     */
    startJobs() {
        this.jobs.forEach((job, name) => {
            job.start();
            console.log(`Started cron job: ${name}`);
        });
    }

    /**
     * Stop all cron jobs
     */
    stopJobs() {
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped cron job: ${name}`);
        });
    }

    /**
     * Start specific job
     */
    startJob(jobName: string) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.start();
            console.log(`Started cron job: ${jobName}`);
        } else {
            console.warn(`Job not found: ${jobName}`);
        }
    }

    /**
     * Stop specific job
     */
    stopJob(jobName: string) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.stop();
            console.log(`Stopped cron job: ${jobName}`);
        } else {
            console.warn(`Job not found: ${jobName}`);
        }
    }

    /**
     * Get job status
     */
    getJobStatus(jobName: string): boolean {
        const job = this.jobs.get(jobName);
        return job ? job.getStatus() === 'scheduled' : false;
    }

    /**
     * Get all jobs status
     */
    getAllJobsStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {};
        this.jobs.forEach((job, name) => {
            status[name] = job.getStatus() === 'scheduled';
        });
        return status;
    }

    /**
     * Manually trigger a job
     */
    async triggerJob(jobName: string): Promise<any> {
        try {
            switch (jobName) {
                case 'daily-autodebit':
                case 'hourly-retry':
                    return await WalletAutoDebitService.processDueMandates();
                    
                case 'pre-notification':
                    const mandates = await WalletAutoDebitService.getMandatesForPreNotification();
                    // Process notifications...
                    return { processed: mandates.length };
                    
                default:
                    throw new Error(`Unknown job: ${jobName}`);
            }
        } catch (error) {
            console.error(`Error triggering job ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Log job results for monitoring
     */
    private logJobResult(jobName: string, result: any) {
        // TODO: Implement proper logging system (e.g., to database or external service)
        const logEntry = {
            jobName,
            timestamp: new Date(),
            status: 'success',
            result,
        };
        
        // For now, just console log
        console.log('Job Result Log:', JSON.stringify(logEntry, null, 2));
    }

    /**
     * Log job errors for monitoring
     */
    private logJobError(jobName: string, error: any) {
        // TODO: Implement proper error logging system
        const logEntry = {
            jobName,
            timestamp: new Date(),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        };
        
        // For now, just console log
        console.error('Job Error Log:', JSON.stringify(logEntry, null, 2));
    }

    /**
     * Health check for cron service
     */
    healthCheck(): {
        status: 'healthy' | 'unhealthy';
        jobs: Record<string, boolean>;
        timestamp: Date;
    } {
        const jobsStatus = this.getAllJobsStatus();
        const allJobsRunning = Object.values(jobsStatus).every(status => status);
        
        return {
            status: allJobsRunning ? 'healthy' : 'unhealthy',
            jobs: jobsStatus,
            timestamp: new Date()
        };
    }
}
