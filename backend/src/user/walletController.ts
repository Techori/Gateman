import type { Request, Response, NextFunction } from "express";
import { WalletModel } from "./walletModel.js";
import type { WalletTopupRequest, WalletPaymentResponse, TopupResponse } from "./walletTypes.js";
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

// Get wallet balance and transaction history
export const getWalletDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user._id;
        
        const wallet = await WalletModel.findOrCreateWallet(userId);
        const transactionHistory = wallet.getTransactionHistory(20);
        
        res.status(200).json({
            success: true,
            message: "Wallet details fetched successfully",
            data: {
                balance: wallet.balance,
                formattedBalance: wallet.formattedBalance,
                transactions: transactionHistory,
                totalTransactions: wallet.transactions.length
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
        const userId = (req as any).user._id;
        const user = (req as any).user;
        const { amount, paymentMethod }: WalletTopupRequest = req.body;

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

        // Create pending transaction
        const pendingTransaction = {
            type: 'credit' as const,
            amount: amounts.creditAmount,
            description: `Wallet topup - ₹${amounts.originalAmount} (10% discount applied)`,
            transactionId,
            paymentMethod: 'wallet_topup' as const,
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
        const { txnid, status, amount, easepayid } = req.body;

        if (status !== 'success') {
            return res.status(400).json({
                success: false,
                message: "Payment was not successful"
            });
        }

        // Find wallet with pending transaction
        const wallet = await WalletModel.findOne({
            'transactions.transactionId': txnid,
            'transactions.status': 'pending'
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found or already processed"
            });
        }

        // Update transaction status
        const transaction = wallet.transactions.find(t => t.transactionId === txnid);
        if (transaction) {
            transaction.status = 'completed';
            transaction.paymentGatewayResponse = req.body;
            
            // Credit the amount to wallet balance
            wallet.balance += transaction.amount;
            await wallet.save();

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

// Handle topup failure callback
export const handleTopupFailure = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { txnid } = req.body;

        // Find wallet with pending transaction
        const wallet = await WalletModel.findOne({
            'transactions.transactionId': txnid,
            'transactions.status': 'pending'
        });

        if (wallet) {
            // Update transaction status to failed
            const transaction = wallet.transactions.find(t => t.transactionId === txnid);
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

// Process rental payment from wallet
export const processRentalPayment = async (
    userId: string,
    rentalId: string,
    amount: number,
    description: string
): Promise<WalletPaymentResponse> => {
    try {
        const wallet = await WalletModel.findOrCreateWallet(userId);
        
        // Calculate GST
        const baseAmount = Math.round(amount / (1 + GST_PERCENT / 100));
        const gstAmount = amount - baseAmount;

        // Check if sufficient balance
        if (!wallet.hasSufficientBalance(amount)) {
            return {
                success: false,
                message: `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${amount}`
            };
        }

        // Debit amount from wallet
        const transaction = wallet.debitAmount(amount, description, rentalId, gstAmount);
        await wallet.save();

        return {
            success: true,
            message: "Payment processed successfully from wallet",
            data: {
                walletBalance: wallet.balance,
                transactionId: transaction._id?.toString() || "",
                amountDebited: amount,
                gstAmount
            }
        };
    } catch (error) {
        console.error("Process rental payment error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Payment processing failed"
        };
    }
};

// Check if rental payment can be made from wallet
export const canPayFromWallet = async (userId: string, amount: number): Promise<boolean> => {
    try {
        const wallet = await WalletModel.findOrCreateWallet(userId);
        return wallet.hasSufficientBalance(amount);
    } catch (error) {
        console.error("Can pay from wallet check error:", error);
        return false;
    }
};

// Get transaction history
export const getTransactionHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user._id;
        const { page = 1, limit = 20, type } = req.query;
        
        const wallet = await WalletModel.findOrCreateWallet(userId);
        
        let transactions = wallet.transactions;
        
        // Filter by type if specified
        if (type && ['credit', 'debit'].includes(type as string)) {
            transactions = transactions.filter((t: any) => t.type === type);
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
                hasPrevPage: (page as number) > 1
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
