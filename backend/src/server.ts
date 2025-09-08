import app from "./app.js";
import { config } from "./config/index.js";
import connectDB from "./config/db.js";
import { AutoDebitCronService } from "./services/autoDebitCronService.js";

const startServer = async () => {
    await connectDB();
    
    // Initialize auto-debit cron service
    const cronService = AutoDebitCronService.getInstance();
    cronService.initializeJobs();
    
    // Start cron jobs if not in test environment
    if (config.env !== 'test') {
        cronService.startJobs();
        console.log('Auto-debit cron service started');
    }
    
    const port = config.port || 4008;

    app.listen(port, () => {
        console.log(`Listening on port :${port}`);
        if (config.env !== 'test') {
            console.log('Auto-debit cron jobs are running');
        }
    });
};

startServer();
