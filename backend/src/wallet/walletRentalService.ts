import { processRentalPayment, checkWalletBalance } from "./walletController.js";
import type { WalletPaymentResponse } from "./walletTypes.js";

// Constants
const GST_PERCENT = 18;
const SHORT_TERM_DAYS_THRESHOLD = 7;
const HOURS_THRESHOLD = 24; // For hourly rentals

// Utility functions
const calculateRentalDuration = (startDate: Date, endDate: Date) => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    return {
        days: diffDays,
        hours: diffHours,
        isShortTerm: diffDays < SHORT_TERM_DAYS_THRESHOLD,
        isHourly: diffHours < HOURS_THRESHOLD && diffDays <= 1
    };
};

const calculateAmountWithGST = (baseAmount: number): number => {
    return Math.round(baseAmount * (1 + GST_PERCENT / 100));
};

const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
};

// Enhanced rental payment processing
export const processEnhancedRentalPayment = async (
    userId: string,
    rentalData: {
        id: string;
        amount: number;
        startDate: Date;
        endDate: Date;
        propertyName: string;
    },
    paymentPreference: 'wallet_only' | 'gateway_only' | 'auto'
): Promise<{
    success: boolean;
    message: string;
    paymentMethod: 'wallet' | 'gateway' | 'mixed';
    walletPayment?: WalletPaymentResponse;
    gatewayRequired?: boolean;
    remainingAmount?: number;
    rentalDuration?: any;
    totalAmountWithGST?: number;
}> => {
    try {
        // Calculate rental duration
        const duration = calculateRentalDuration(rentalData.startDate, rentalData.endDate);
        
        // Calculate total amount with GST
        const totalAmountWithGST = calculateAmountWithGST(rentalData.amount);
        
        // Create payment description
        let description = "";
        if (duration.isHourly) {
            description = `Rental payment for ${rentalData.propertyName} (${duration.hours} hours)`;
        } else {
            description = `Rental payment for ${rentalData.propertyName} (${duration.days} days)`;
        }

        // Determine payment logic based on rental duration and user preference
        if (duration.isShortTerm || duration.isHourly) {
            // For short-term rentals (< 7 days or hourly), try wallet payment first
            const hasWalletBalance = await checkWalletBalance(userId, totalAmountWithGST);
            
            if (hasWalletBalance && paymentPreference !== 'gateway_only') {
                // Process payment from wallet
                const walletPayment = await processRentalPayment(
                    userId, 
                    rentalData.id, 
                    totalAmountWithGST, 
                    description
                );
                
                if (walletPayment.success) {
                    return {
                        success: true,
                        message: `Payment successful via wallet. ${formatCurrency(totalAmountWithGST)} debited.`,
                        paymentMethod: 'wallet',
                        walletPayment,
                        rentalDuration: duration,
                        totalAmountWithGST
                    };
                }
            }
            
            // If wallet payment fails or insufficient balance, require gateway payment
            return {
                success: false,
                message: duration.isHourly 
                    ? "Insufficient wallet balance for hourly rental. Please top up your wallet or use payment gateway."
                    : "Insufficient wallet balance for short-term rental. Please top up your wallet or use payment gateway.",
                paymentMethod: 'gateway',
                gatewayRequired: true,
                remainingAmount: totalAmountWithGST,
                rentalDuration: duration,
                totalAmountWithGST
            };
        } else {
            // For long-term rentals (>= 7 days), provide both options
            const hasWalletBalance = await checkWalletBalance(userId, totalAmountWithGST);
            
            if (paymentPreference === 'wallet_only' && hasWalletBalance) {
                // Process payment from wallet
                const walletPayment = await processRentalPayment(
                    userId, 
                    rentalData.id, 
                    totalAmountWithGST, 
                    description
                );
                
                if (walletPayment.success) {
                    return {
                        success: true,
                        message: `Payment successful via wallet. ${formatCurrency(totalAmountWithGST)} debited.`,
                        paymentMethod: 'wallet',
                        walletPayment,
                        rentalDuration: duration,
                        totalAmountWithGST
                    };
                }
            }
            
            if (paymentPreference === 'gateway_only' || !hasWalletBalance) {
                return {
                    success: false,
                    message: "Payment gateway required for long-term rental.",
                    paymentMethod: 'gateway',
                    gatewayRequired: true,
                    remainingAmount: totalAmountWithGST,
                    rentalDuration: duration,
                    totalAmountWithGST
                };
            }
            
            // Auto mode - give user choice
            return {
                success: false,
                message: hasWalletBalance 
                    ? "You can pay via wallet or payment gateway for this rental."
                    : "Insufficient wallet balance. Payment gateway required.",
                paymentMethod: 'mixed',
                gatewayRequired: true,
                remainingAmount: totalAmountWithGST,
                rentalDuration: duration,
                totalAmountWithGST
            };
        }
    } catch (error) {
        console.error("Enhanced rental payment processing error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Payment processing failed",
            paymentMethod: 'gateway',
            gatewayRequired: true
        };
    }
};

// Check payment options for a rental
export const checkRentalPaymentOptions = async (
    userId: string,
    rentalData: {
        amount: number;
        startDate: Date;
        endDate: Date;
    }
): Promise<{
    walletEligible: boolean;
    gatewayRequired: boolean;
    isShortTerm: boolean;
    isHourly: boolean;
    totalAmountWithGST: number;
    walletBalance?: number;
    paymentOptions: string[];
}> => {
    try {
        const duration = calculateRentalDuration(rentalData.startDate, rentalData.endDate);
        const totalAmountWithGST = calculateAmountWithGST(rentalData.amount);
        const hasWalletBalance = await checkWalletBalance(userId, totalAmountWithGST);
        
        let paymentOptions: string[] = [];
        
        if (duration.isShortTerm || duration.isHourly) {
            // Short-term rentals prefer wallet
            if (hasWalletBalance) {
                paymentOptions = ['wallet', 'gateway'];
            } else {
                paymentOptions = ['gateway'];
            }
        } else {
            // Long-term rentals can use both
            if (hasWalletBalance) {
                paymentOptions = ['wallet', 'gateway'];
            } else {
                paymentOptions = ['gateway'];
            }
        }
        
        return {
            walletEligible: hasWalletBalance,
            gatewayRequired: !hasWalletBalance || (!duration.isShortTerm && !duration.isHourly),
            isShortTerm: duration.isShortTerm,
            isHourly: duration.isHourly,
            totalAmountWithGST,
            paymentOptions
        };
    } catch (error) {
        console.error("Check rental payment options error:", error);
        return {
            walletEligible: false,
            gatewayRequired: true,
            isShortTerm: false,
            isHourly: false,
            totalAmountWithGST: calculateAmountWithGST(rentalData.amount),
            paymentOptions: ['gateway']
        };
    }
};
