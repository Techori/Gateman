import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { WalletModel } from "./walletModel.js";
import { ServiceModel } from "./serviceModel.js";
import { WalletCashbackRuleModel } from "./cashbackRuleModel.js";
import { User } from "./userModel.js";
import axios from "axios";
import type { 
    WalletTopupRequest, 
    WalletPaymentResponse, 
    TopupResponse, 
    WalletPaymentRequest,
    WalletRefundRequest,
    WalletSummary 
} from "./walletTypes.js";
import { config } from "../config/index.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

// Constants
const MIN_TOPUP_AMOUNT = 200;
const WALLET_DISCOUNT_PERCENT = 10;
const GST_PERCENT = 18;

// Easebuzz configuration
const easebuzzConfig = {
    key: config.EASEBUZZ_KEY,
    salt: config.EASEBUZZ_SALT,
    env: config.EASEBUZZ_ENV,
    baseUrl: {
        test: 'https://testpay.easebuzz.in',
        prod: 'https://pay.easebuzz.in'
    }
};

// Utility functions
const calculateWalletTopupAmounts = (originalAmount: number) => {
    const discountAmount = Math.round((originalAmount * WALLET_DISCOUNT_PERCENT) / 100);
    const discountedAmount = originalAmount - discountAmount;
    const gstAmount = Math.round((discountedAmount * GST_PERCENT) / 100);
    const finalAmount = discountedAmount + gstAmount;
    
    return {
        originalAmount,
        discountAmount,
        discountedAmount,
        gstAmount,
        finalAmount,
        creditAmount: originalAmount // User gets the full original amount credited
    };
};

const generateTransactionId = () => {
    return `WALLET_${Date.now()}_${uuidv4().substring(0, 8).toUpperCase()}`;
};

const generateEasebuzzHash = (data: any) => {
    const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${easebuzzConfig.salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
};

// Create wallet for user (auto-created on registration)
export const createWallet = async (userId: string) => {
    try {
        const existingWallet = await WalletModel.findOne({ userId });
        if (existingWallet) {
            return existingWallet;
        }

        const wallet = await WalletModel.create({
            userId,
            balance: 0,
            status: 'active',
            transactions: []
        });

        return wallet;
    } catch (error) {
        console.error("Create wallet error:", error);
        throw new Error("Failed to create wallet");
    }
};

// Get wallet balance and transaction history
export const getWalletDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any)._id;
        
        const wallet = await WalletModel.findOrCreateWallet(userId);
        const transactionHistory = wallet.getTransactionHistory(20);
        
        res.status(200).json({
            success: true,
            message: "Wallet details fetched successfully",
            data: {
                walletId: wallet._id,
                balance: wallet.balance,
                formattedBalance: wallet.formattedBalance,
                status: wallet.status,
                transactions: transactionHistory,
                totalTransactions: wallet.transactions.length,
                canTransact: wallet.status === 'active'
            }
        });
    } catch (error) {
        console.error("Get wallet details error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wallet details",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Initiate wallet topup
export const initiateWalletTopup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq._id;
        const { amount, paymentMethod }: WalletTopupRequest = req.body;

        // Get user details from database
        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Validation
        if (!amount || amount < MIN_TOPUP_AMOUNT) {
            return res.status(400).json({
                success: false,
                message: `Minimum topup amount is ₹${MIN_TOPUP_AMOUNT}`
            });
        }

        if (!paymentMethod || !['easebuzz', 'cashfree'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method. Supported methods: easebuzz, cashfree"
            });
        }

        // Calculate amounts
        const amounts = calculateWalletTopupAmounts(amount);
        const transactionId = generateTransactionId();

        // Get or create wallet
        const wallet = await WalletModel.findOrCreateWallet(userId);

        if (wallet.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: "Wallet is not active. Please contact support."
            });
        }

        // Create pending transaction
        const pendingTransaction = {
            walletId: wallet._id.toString(),
            transactionType: 'credit' as const,
            amount: amounts.creditAmount,
            description: `Wallet topup - ₹${amounts.originalAmount} (10% discount applied)`,
            transactionReference: transactionId,
            gstAmount: amounts.gstAmount,
            discountAmount: amounts.discountAmount,
            originalAmount: amounts.originalAmount,
            status: 'pending' as const,
            createdAt: new Date(),
        };

        wallet.transactions.push(pendingTransaction);
        await wallet.save();

        let paymentResponse: any = {};

        // Handle different payment methods
        if (paymentMethod === 'easebuzz') {
            // Validate Easebuzz credentials
            if (!easebuzzConfig.key || !easebuzzConfig.salt || 
                easebuzzConfig.key === 'your_actual_easebuzz_merchant_key' ||
                easebuzzConfig.salt === 'your_actual_easebuzz_salt_key') {
                return res.status(500).json({
                    success: false,
                    message: "Easebuzz credentials not properly configured",
                    error: "Please configure EASEBUZZ_KEY and EASEBUZZ_SALT in environment variables"
                });
            }

            const paymentData: any = {
                key: easebuzzConfig.key,
                txnid: transactionId,
                amount: amounts.finalAmount.toString(),
                productinfo: `Wallet Topup - ₹${amounts.originalAmount}`,
                firstname: user.name,
                lastname: "",
                email: user.email,
                phone: user.phoneNumber,
                surl: `${config.frontendDomain}/wallet/topup/success`,
                furl: `${config.frontendDomain}/wallet/topup/failure`,
                udf1: userId,
                udf2: "wallet_topup",
                udf3: amounts.originalAmount.toString(),
                udf4: amounts.discountAmount.toString(),
                udf5: amounts.gstAmount.toString(),
            };

            paymentData.hash = generateEasebuzzHash(paymentData);
            
            const baseUrl = easebuzzConfig.env === 'prod' 
                ? easebuzzConfig.baseUrl.prod 
                : easebuzzConfig.baseUrl.test;
            
            paymentResponse = {
                paymentUrl: `${baseUrl}/payment/initiateLink`,
                paymentData,
                method: 'POST'
            };
        } else if (paymentMethod === 'cashfree') {
            // Cashfree integration
            const cashfreeBaseUrl = config.CASHFREE_ENV === 'PROD' 
                ? 'https://api.cashfree.com/pg' 
                : 'https://sandbox.cashfree.com/pg';

            const orderData = {
                order_amount: amounts.finalAmount,
                order_currency: "INR",
                order_id: transactionId,
                customer_details: {
                    customer_id: userId,
                    customer_name: user.name,
                    customer_email: user.email,
                    customer_phone: user.phoneNumber
                },
                order_meta: {
                    return_url: `${config.frontendDomain}/wallet/topup/success?payment_method=cashfree`,
                    notify_url: `${config.backendDomain}/api/v1/wallet/topup/success`,
                    payment_methods: "cc,dc,nb,upi,paylater,app"
                },
                order_note: `Wallet Topup - ₹${amounts.originalAmount} (10% discount applied)`
            };

            try {
                const cashfreeResponse = await axios.post(`${cashfreeBaseUrl}/orders`, orderData, {
                    headers: {
                        'X-Client-Id': config.CASHFREE_APP_ID,
                        'X-Client-Secret': config.CASHFREE_SECRET_KEY,
                        'X-API-Version': '2022-09-01',
                        'Content-Type': 'application/json'
                    }
                });

                const cashfreeData = cashfreeResponse.data;

                if (cashfreeResponse.status === 200 && cashfreeData.payment_session_id) {
                    paymentResponse = {
                        paymentSessionId: cashfreeData.payment_session_id,
                        orderId: cashfreeData.order_id,
                        paymentUrl: cashfreeData.payment_link,
                        cashfreeOrderId: cashfreeData.cf_order_id
                    };
                } else {
                    throw new Error(`Cashfree order creation failed: ${JSON.stringify(cashfreeData)}`);
                }
            } catch (cashfreeError: any) {
                console.error("Cashfree order creation error:", cashfreeError);
                
                // Log detailed error information for axios errors
                if (cashfreeError.response) {
                    console.error("Cashfree API Response:", {
                        status: cashfreeError.response.status,
                        statusText: cashfreeError.response.statusText,
                        data: cashfreeError.response.data,
                        headers: cashfreeError.response.headers
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: "Failed to create payment order with Cashfree",
                    error: cashfreeError instanceof Error ? cashfreeError.message : "Unknown error",
                    details: cashfreeError.response?.data || null
                });
            }
        }

        const response: TopupResponse = {
            success: true,
            message: "Wallet topup initiated successfully",
            data: {
                transactionId,
                finalAmount: amounts.finalAmount,
                discountAmount: amounts.discountAmount,
                gstAmount: amounts.gstAmount,
                ...paymentResponse
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Initiate wallet topup error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to initiate wallet topup",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Handle topup success callback
export const handleTopupSuccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Support both EaseBuzz and Cashfree callback formats
        const { 
            // EaseBuzz fields
            txnid, status, amount, easepayid,
            // Cashfree fields  
            order_id, cf_order_id, payment_status, order_amount 
        } = req.body;

        const transactionId = txnid || order_id;
        const paymentStatus = status || payment_status;
        const paymentAmount = amount || order_amount;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Transaction ID not found in callback"
            });
        }

        if (paymentStatus !== 'success' && paymentStatus !== 'PAID') {
            return res.status(400).json({
                success: false,
                message: `Payment was not successful. Status: ${paymentStatus}`
            });
        }

        // Find wallet with pending transaction
        const wallet = await WalletModel.findOne({
            'transactions.transactionReference': transactionId,
            'transactions.status': 'pending'
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found or already processed"
            });
        }

        // Update transaction status
        const transaction = wallet.transactions.find(t => t.transactionReference === transactionId);
        if (transaction) {
            transaction.status = 'success';
            transaction.paymentGatewayResponse = req.body;
            
            // Credit the amount to wallet balance only if not already credited
            if (transaction.transactionType === 'credit') {
                wallet.balance += transaction.amount;
            }
            
            await wallet.save();

            // Apply any applicable cashback rules
            try {
                await applyTopupCashback(wallet, transaction.amount);
            } catch (cashbackError) {
                console.error("Error applying cashback:", cashbackError);
                // Don't fail the main transaction if cashback fails
            }

            res.status(200).json({
                success: true,
                message: "Wallet topup completed successfully",
                data: {
                    newBalance: wallet.balance,
                    amountCredited: transaction.amount,
                    transactionId: txnid
                }
            });
        }
    } catch (error) {
        console.error("Handle topup success error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process topup success",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Apply cashback for topup (helper function)
const applyTopupCashback = async (wallet: any, topupAmount: number) => {
    try {
        const now = new Date();
        const applicableRules = await WalletCashbackRuleModel.find({
            status: 'active',
            validFrom: { $lte: now },
            validTo: { $gte: now },
            minAmount: { $lte: topupAmount },
            $or: [
                { serviceType: 'All' },
                { serviceType: { $exists: false } }
            ]
        }).sort({ cashbackAmount: -1 });
        
        for (const rule of applicableRules) {
            // Check if rule is valid
            const isRuleValid = rule.status === 'active' && 
                              rule.validFrom <= now && 
                              rule.validTo >= now;
            
            if (isRuleValid) {
                // Calculate cashback amount
                let cashbackAmount = 0;
                if (topupAmount >= rule.minAmount) {
                    if (rule.cashbackType === 'percentage') {
                        cashbackAmount = (topupAmount * rule.cashbackAmount) / 100;
                        if (rule.maxCashback) {
                            cashbackAmount = Math.min(cashbackAmount, rule.maxCashback);
                        }
                    } else {
                        cashbackAmount = rule.cashbackAmount;
                    }
                }
                
                if (cashbackAmount > 0) {
                    wallet.applyCashback(
                        cashbackAmount, 
                        `Topup cashback: ${rule.description}`,
                        rule._id.toString()
                    );
                    await wallet.save();
                    break; // Apply only the first (highest) cashback rule
                }
            }
        }
    } catch (error) {
        console.error("Apply topup cashback error:", error);
        throw error;
    }
};

// Handle topup failure callback
export const handleTopupFailure = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Support both EaseBuzz and Cashfree callback formats
        const { txnid, order_id } = req.body;
        const transactionId = txnid || order_id;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Transaction ID not found in failure callback"
            });
        }

        // Find wallet with pending transaction
        const wallet = await WalletModel.findOne({
            'transactions.transactionReference': transactionId,
            'transactions.status': 'pending'
        });

        if (wallet) {
            // Update transaction status to failed
            const transaction = wallet.transactions.find(t => t.transactionReference === transactionId);
            if (transaction) {
                transaction.status = 'failed';
                transaction.paymentGatewayResponse = req.body;
                await wallet.save();
            }
        }

        res.status(200).json({
            success: false,
            message: "Wallet topup failed",
            data: {
                transactionId: txnid
            }
        });
    } catch (error) {
        console.error("Handle topup failure error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process topup failure",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Process service payment from wallet
export const processServicePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq._id;
        const { serviceId, amount, description, bookingId }: WalletPaymentRequest = req.body;

        // Validation
        if (!serviceId || !amount || !description) {
            return res.status(400).json({
                success: false,
                message: "Service ID, amount, and description are required"
            });
        }

        // Verify service exists
        const service = await ServiceModel.findById(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        if (!service.isActive) {
            return res.status(400).json({
                success: false,
                message: "Service is not active"
            });
        }

        const wallet = await WalletModel.findOrCreateWallet(userId);
        
        // Calculate GST
        const baseAmount = Math.round(amount / (1 + GST_PERCENT / 100));
        const gstAmount = amount - baseAmount;

        // Check if sufficient balance and wallet is active
        if (!wallet.hasSufficientBalance(amount)) {
            return res.status(400).json({
                success: false,
                message: `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${amount}`
            });
        }

        // Generate transaction reference
        const transactionReference = `SERVICE_${Date.now()}_${uuidv4().substring(0, 8).toUpperCase()}`;

        // Debit amount from wallet
        const transaction = wallet.debitAmount(
            amount, 
            description, 
            serviceId,
            bookingId,
            transactionReference,
            gstAmount
        );
        
        await wallet.save();

        // Apply cashback if applicable
        try {
            await applyServiceCashback(wallet, amount, service.name, serviceId);
        } catch (cashbackError) {
            console.error("Error applying service cashback:", cashbackError);
            // Don't fail the main transaction if cashback fails
        }

        res.status(200).json({
            success: true,
            message: "Payment processed successfully from wallet",
            data: {
                walletBalance: wallet.balance,
                transactionId: transaction._id?.toString() || "",
                transactionReference,
                amountDebited: amount,
                gstAmount,
                serviceDetails: {
                    serviceId: service._id,
                    serviceName: service.name,
                    servicePrice: service.price
                }
            }
        });
    } catch (error) {
        console.error("Process service payment error:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Payment processing failed"
        });
    }
};

// Apply cashback for service payment (helper function)
const applyServiceCashback = async (wallet: any, paymentAmount: number, serviceName: string, serviceId: string) => {
    try {
        const now = new Date();
        const applicableRules = await WalletCashbackRuleModel.find({
            status: 'active',
            validFrom: { $lte: now },
            validTo: { $gte: now },
            minAmount: { $lte: paymentAmount },
            $or: [
                { serviceType: serviceName },
                { serviceType: 'All' }
            ]
        }).sort({ cashbackAmount: -1 });
        
        for (const rule of applicableRules) {
            // Check if rule is valid
            const isRuleValid = rule.status === 'active' && 
                              rule.validFrom <= now && 
                              rule.validTo >= now;
            
            if (isRuleValid) {
                // Calculate cashback amount
                let cashbackAmount = 0;
                if (paymentAmount >= rule.minAmount) {
                    if (rule.cashbackType === 'percentage') {
                        cashbackAmount = (paymentAmount * rule.cashbackAmount) / 100;
                        if (rule.maxCashback) {
                            cashbackAmount = Math.min(cashbackAmount, rule.maxCashback);
                        }
                    } else {
                        cashbackAmount = rule.cashbackAmount;
                    }
                }
                
                if (cashbackAmount > 0) {
                    wallet.applyCashback(
                        cashbackAmount, 
                        `Service cashback: ${rule.description} for ${serviceName}`,
                        rule._id.toString()
                    );
                    await wallet.save();
                    break; // Apply only the first (highest) cashback rule
                }
            }
        }
    } catch (error) {
        console.error("Apply service cashback error:", error);
        throw error;
    }
};

// Check if payment can be made from wallet
export const canPayFromWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq._id;
        const { amount } = req.query;

        if (!amount || isNaN(Number(amount))) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        const wallet = await WalletModel.findOrCreateWallet(userId);
        const canPay = wallet.hasSufficientBalance(Number(amount));

        res.status(200).json({
            success: true,
            message: "Payment capability checked",
            data: {
                canPayFromWallet: canPay,
                currentBalance: wallet.balance,
                requiredAmount: Number(amount),
                shortfall: canPay ? 0 : Number(amount) - wallet.balance,
                walletStatus: wallet.status
            }
        });
    } catch (error) {
        console.error("Can pay from wallet check error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check payment capability",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Request refund to wallet
export const requestRefund = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq._id;
        const { originalTransactionId, refundAmount, reason }: WalletRefundRequest = req.body;

        // Validation
        if (!originalTransactionId || !refundAmount || !reason) {
            return res.status(400).json({
                success: false,
                message: "Original transaction ID, refund amount, and reason are required"
            });
        }

        if (refundAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Refund amount must be positive"
            });
        }

        const wallet = await WalletModel.findOrCreateWallet(userId);

        // Find the original transaction
        const originalTransaction = wallet.transactions.find(t => 
            t._id?.toString() === originalTransactionId || 
            t.transactionReference === originalTransactionId
        );

        if (!originalTransaction) {
            return res.status(404).json({
                success: false,
                message: "Original transaction not found"
            });
        }

        if (originalTransaction.transactionType !== 'debit') {
            return res.status(400).json({
                success: false,
                message: "Can only refund debit transactions"
            });
        }

        if (refundAmount > originalTransaction.amount) {
            return res.status(400).json({
                success: false,
                message: "Refund amount cannot exceed original transaction amount"
            });
        }

        // Process instant refund to wallet
        const refundTransaction = wallet.processRefund(originalTransactionId, refundAmount, reason);
        await wallet.save();

        res.status(200).json({
            success: true,
            message: "Refund processed successfully",
            data: {
                refundTransactionId: refundTransaction._id?.toString(),
                refundAmount,
                newWalletBalance: wallet.balance,
                originalTransactionId,
                refundReason: reason
            }
        });
    } catch (error) {
        console.error("Request refund error:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to process refund"
        });
    }
};

// Get transaction history
export const getTransactionHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq._id;
        const { page = 1, limit = 20, type, status } = req.query;
        
        const wallet = await WalletModel.findOrCreateWallet(userId);
        
        let transactions = wallet.transactions;
        
        // Filter by transaction type if specified
        if (type && ['credit', 'debit', 'refund', 'cashback'].includes(type as string)) {
            transactions = transactions.filter((t: any) => t.transactionType === type);
        }
        
        // Filter by status if specified
        if (status && ['success', 'pending', 'failed'].includes(status as string)) {
            transactions = transactions.filter((t: any) => t.status === status);
        }
        
        // Sort by date (newest first)
        transactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Pagination
        const startIndex = ((page as number) - 1) * (limit as number);
        const endIndex = startIndex + (limit as number);
        const paginatedTransactions = transactions.slice(startIndex, endIndex);
        
        res.status(200).json({
            success: true,
            message: "Transaction history fetched successfully",
            data: {
                transactions: paginatedTransactions,
                totalTransactions: transactions.length,
                currentPage: page,
                totalPages: Math.ceil(transactions.length / (limit as number)),
                hasNextPage: endIndex < transactions.length,
                hasPrevPage: (page as number) > 1,
                filters: { type, status }
            }
        });
    } catch (error) {
        console.error("Get transaction history error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transaction history",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// ADMIN FUNCTIONS

// Get all wallets (admin only)
export const getAllWallets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { page = 1, limit = 50, status, minBalance, maxBalance } = req.query;
        
        // Build query filter
        const filter: any = {};
        if (status && ['active', 'inactive', 'blocked'].includes(status as string)) {
            filter.status = status;
        }
        if (minBalance) {
            filter.balance = { ...filter.balance, $gte: Number(minBalance) };
        }
        if (maxBalance) {
            filter.balance = { ...filter.balance, $lte: Number(maxBalance) };
        }

        const skip = ((page as number) - 1) * (limit as number);

        const wallets = await WalletModel.find(filter)
            .populate('userId', 'name email role')
            .sort({ balance: -1 })
            .skip(skip)
            .limit(limit as number);

        const totalWallets = await WalletModel.countDocuments(filter);

        // Calculate summary statistics
        const summary = await WalletModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalWallets: { $sum: 1 },
                    totalBalance: { $sum: "$balance" },
                    avgBalance: { $avg: "$balance" },
                    maxBalance: { $max: "$balance" },
                    minBalance: { $min: "$balance" }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            message: "Wallets fetched successfully",
            data: {
                wallets,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalWallets / (limit as number)),
                    totalWallets,
                    limit,
                    hasNextPage: skip + (limit as number) < totalWallets,
                    hasPrevPage: (page as number) > 1
                },
                summary: summary[0] || {
                    totalWallets: 0,
                    totalBalance: 0,
                    avgBalance: 0,
                    maxBalance: 0,
                    minBalance: 0
                },
                filters: { status, minBalance, maxBalance }
            }
        });
    } catch (error) {
        console.error("Get all wallets error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wallets",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Get all transactions (admin only)
export const getAllTransactions = async (req: Request, res: Response, next: NextFunction) => {
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
            page = 1, 
            limit = 50, 
            type, 
            status, 
            userId,
            serviceId,
            fromDate,
            toDate,
            minAmount,
            maxAmount
        } = req.query;

        // Build aggregation pipeline
        const pipeline: any[] = [
            { $unwind: "$transactions" },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" }
        ];

        // Add filters
        const matchConditions: any = {};
        if (type) matchConditions["transactions.transactionType"] = type;
        if (status) matchConditions["transactions.status"] = status;
        if (userId) matchConditions["userId"] = userId;
        if (serviceId) matchConditions["transactions.serviceId"] = serviceId;
        if (minAmount) matchConditions["transactions.amount"] = { $gte: Number(minAmount) };
        if (maxAmount) matchConditions["transactions.amount"] = { ...matchConditions["transactions.amount"], $lte: Number(maxAmount) };
        if (fromDate || toDate) {
            const dateFilter: any = {};
            if (fromDate) dateFilter.$gte = new Date(fromDate as string);
            if (toDate) dateFilter.$lte = new Date(toDate as string);
            matchConditions["transactions.createdAt"] = dateFilter;
        }

        if (Object.keys(matchConditions).length > 0) {
            pipeline.push({ $match: matchConditions });
        }

        // Add sorting and pagination
        pipeline.push(
            { $sort: { "transactions.createdAt": -1 } },
            { $skip: ((page as number) - 1) * (limit as number) },
            { $limit: limit as number },
            {
                $project: {
                    _id: "$transactions._id",
                    walletId: "$_id",
                    userId: "$userId",
                    userName: "$user.name",
                    userEmail: "$user.email",
                    transactionType: "$transactions.transactionType",
                    amount: "$transactions.amount",
                    description: "$transactions.description",
                    transactionReference: "$transactions.transactionReference",
                    status: "$transactions.status",
                    serviceId: "$transactions.serviceId",
                    bookingId: "$transactions.bookingId",
                    gstAmount: "$transactions.gstAmount",
                    createdAt: "$transactions.createdAt"
                }
            }
        );

        const transactions = await WalletModel.aggregate(pipeline);

        // Get total count
        const countPipeline = pipeline.slice(0, -3); // Remove sort, skip, limit, project
        countPipeline.push({ $count: "total" });
        const totalResult = await WalletModel.aggregate(countPipeline);
        const totalTransactions = totalResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            message: "Transactions fetched successfully",
            data: {
                transactions,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalTransactions / (limit as number)),
                    totalTransactions,
                    limit,
                    hasNextPage: ((page as number) - 1) * (limit as number) + (limit as number) < totalTransactions,
                    hasPrevPage: (page as number) > 1
                },
                filters: { type, status, userId, serviceId, fromDate, toDate, minAmount, maxAmount }
            }
        });
    } catch (error) {
        console.error("Get all transactions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transactions",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Block/Unblock wallet (admin only)
export const updateWalletStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { walletId } = req.params;
        const { status, reason } = req.body;

        if (!['active', 'inactive', 'blocked'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'active', 'inactive', or 'blocked'"
            });
        }

        const wallet = await WalletModel.findById(walletId);
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        const oldStatus = wallet.status;
        wallet.status = status;

        // Log the status change
        const description = reason ? 
            `Wallet status changed from ${oldStatus} to ${status} by admin. Reason: ${reason}` :
            `Wallet status changed from ${oldStatus} to ${status} by admin`;

        wallet.creditAmount(0, description, `STATUS_${Date.now()}_${walletId}`, 'credit');
        
        await wallet.save();

        res.status(200).json({
            success: true,
            message: `Wallet status updated to ${status}`,
            data: {
                walletId,
                oldStatus,
                newStatus: status,
                reason,
                adminId: currentUser._id
            }
        });
    } catch (error) {
        console.error("Update wallet status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update wallet status",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Admin balance adjustment
export const adjustWalletBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        const { walletId } = req.params;
        const { amount, reason, adjustmentType } = req.body;

        if (!amount || !reason || !adjustmentType) {
            return res.status(400).json({
                success: false,
                message: "Amount, reason, and adjustment type are required"
            });
        }

        if (!['credit', 'debit'].includes(adjustmentType)) {
            return res.status(400).json({
                success: false,
                message: "Adjustment type must be 'credit' or 'debit'"
            });
        }

        const wallet = await WalletModel.findById(walletId);
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        const oldBalance = wallet.balance;
        const transactionReference = `ADMIN_ADJ_${Date.now()}_${walletId}`;
        
        let transaction;
        if (adjustmentType === 'credit') {
            transaction = wallet.creditAmount(
                amount, 
                `Admin credit adjustment: ${reason}`,
                transactionReference,
                'credit'
            );
        } else {
            if (wallet.balance < amount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for debit adjustment"
                });
            }
            transaction = wallet.debitAmount(
                amount, 
                `Admin debit adjustment: ${reason}`,
                undefined,
                undefined,
                transactionReference
            );
        }

        await wallet.save();

        res.status(200).json({
            success: true,
            message: `Wallet balance adjusted successfully`,
            data: {
                walletId,
                adjustmentType,
                amount,
                oldBalance,
                newBalance: wallet.balance,
                reason,
                transactionId: transaction._id?.toString(),
                transactionReference,
                adminId: currentUser._id
            }
        });
    } catch (error) {
        console.error("Adjust wallet balance error:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to adjust wallet balance"
        });
    }
};

// Get wallet summary/dashboard stats (admin only)
export const getWalletSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUser = (req as any).user;
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin role required."
            });
        }

        // Get overall statistics
        const summary = await WalletModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    totalWalletBalance: { $sum: "$balance" },
                    avgBalance: { $avg: "$balance" },
                    maxBalance: { $max: "$balance" },
                    minBalance: { $min: "$balance" }
                }
            }
        ]);

        // Get status-wise count
        const statusStats = await WalletModel.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalBalance: { $sum: "$balance" }
                }
            }
        ]);

        // Get recent transactions (last 10)
        const recentTransactions = await WalletModel.aggregate([
            { $unwind: "$transactions" },
            { $sort: { "transactions.createdAt": -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    _id: "$transactions._id",
                    walletId: "$_id",
                    userId: "$userId",
                    userName: "$user.name",
                    transactionType: "$transactions.transactionType",
                    amount: "$transactions.amount",
                    description: "$transactions.description",
                    status: "$transactions.status",
                    createdAt: "$transactions.createdAt"
                }
            }
        ]);

        // Get top users by balance
        const topUsers = await WalletModel.find({ balance: { $gt: 0 } })
            .populate('userId', 'name email')
            .sort({ balance: -1 })
            .limit(10)
            .select('userId balance');

        // Get transaction volume stats for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const transactionStats = await WalletModel.aggregate([
            { $unwind: "$transactions" },
            { $match: { "transactions.createdAt": { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: "$transactions.transactionType",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$transactions.amount" },
                    avgAmount: { $avg: "$transactions.amount" }
                }
            }
        ]);

        const result: WalletSummary = {
            totalUsers: summary[0]?.totalUsers || 0,
            totalWalletBalance: summary[0]?.totalWalletBalance || 0,
            totalTransactions: transactionStats.reduce((sum, stat) => sum + stat.count, 0),
            recentTransactions,
            topUsers: topUsers.map(wallet => ({
                userId: wallet.userId,
                userName: (wallet.userId as any)?.name || 'Unknown',
                balance: wallet.balance,
                transactionCount: wallet.transactions.length
            }))
        };

        res.status(200).json({
            success: true,
            message: "Wallet summary fetched successfully",
            data: {
                summary: result,
                statusStats: statusStats.reduce((acc, stat) => {
                    acc[stat._id] = { count: stat.count, totalBalance: stat.totalBalance };
                    return acc;
                }, {}),
                transactionStats: transactionStats.reduce((acc, stat) => {
                    acc[stat._id] = { 
                        count: stat.count, 
                        totalAmount: stat.totalAmount,
                        avgAmount: stat.avgAmount 
                    };
                    return acc;
                }, {}),
                overallStats: summary[0] || {
                    totalUsers: 0,
                    totalWalletBalance: 0,
                    avgBalance: 0,
                    maxBalance: 0,
                    minBalance: 0
                }
            }
        });
    } catch (error) {
        console.error("Get wallet summary error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wallet summary",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
