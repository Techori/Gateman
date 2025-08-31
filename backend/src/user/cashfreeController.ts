import type { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config/index.js';

// Cashfree API Configuration
const getCashfreeHeaders = () => ({
    'X-Client-Id': config.CASHFREE_APP_ID,
    'X-Client-Secret': config.CASHFREE_SECRET_KEY,
    'X-API-Version': '2023-08-01',
    'Content-Type': 'application/json'
});

const getCashfreeBaseURL = () => {
    return config.CASHFREE_ENV === 'PROD' 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg';
};

// Generate unique order ID
const generateOrderId = (): string => {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create Payment Order
export const createPaymentOrder = async (req: Request, res: Response) => {
    try {
        const { amount, customer_name, customer_email, customer_phone, return_url } = req.body;

        // Validate required fields
        if (!amount || !customer_name || !customer_email || !customer_phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: amount, customer_name, customer_email, customer_phone'
            });
        }

        const orderId = generateOrderId();

        const requestData = {
            order_amount: parseFloat(amount),
            order_currency: "INR",
            order_id: orderId,
            customer_details: {
                customer_id: `customer_${Date.now()}`,
                customer_name: customer_name,
                customer_email: customer_email,
                customer_phone: customer_phone,
            },
            order_meta: {
                return_url: return_url || `${config.frontendDomain}/payment/callback`,
                notify_url: `${config.frontendDomain}/api/v1/cashfree/webhook`,
            }
        };

        const response = await axios.post(
            `${getCashfreeBaseURL()}/orders`,
            requestData,
            { headers: getCashfreeHeaders() }
        );
        
        res.status(200).json({
            success: true,
            message: 'Payment order created successfully',
            data: {
                order_id: orderId,
                payment_session_id: response.data.payment_session_id,
                order_status: response.data.order_status,
                payment_link: response.data.payment_link,
                cf_order_id: response.data.cf_order_id,
            }
        });

    } catch (error: any) {
        console.error('Cashfree create order error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order',
            error: error.response?.data || error.message
        });
    }
};

// Get Payment Order Status
export const getOrderStatus = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const response = await axios.get(
            `${getCashfreeBaseURL()}/orders/${orderId}`,
            { headers: getCashfreeHeaders() }
        );
        
        res.status(200).json({
            success: true,
            message: 'Order status fetched successfully',
            data: response.data
        });

    } catch (error: any) {
        console.error('Cashfree get order status error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order status',
            error: error.response?.data || error.message
        });
    }
};

// Get Payment Details
export const getPaymentDetails = async (req: Request, res: Response) => {
    try {
        const { orderId, cfPaymentId } = req.params;

        if (!orderId || !cfPaymentId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and CF Payment ID are required'
            });
        }

        const response = await axios.get(
            `${getCashfreeBaseURL()}/orders/${orderId}/payments/${cfPaymentId}`,
            { headers: getCashfreeHeaders() }
        );
        
        res.status(200).json({
            success: true,
            message: 'Payment details fetched successfully',
            data: response.data
        });

    } catch (error: any) {
        console.error('Cashfree get payment details error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment details',
            error: error.response?.data || error.message
        });
    }
};

// Verify Payment
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const response = await axios.get(
            `${getCashfreeBaseURL()}/orders/${orderId}`,
            { headers: getCashfreeHeaders() }
        );
        
        const paymentStatus = response.data.order_status;
        const isSuccess = paymentStatus === 'PAID';
        
        res.status(200).json({
            success: true,
            message: isSuccess ? 'Payment verified successfully' : 'Payment verification failed',
            data: {
                order_id: orderId,
                payment_status: paymentStatus,
                is_payment_success: isSuccess,
                order_amount: response.data.order_amount,
                order_currency: response.data.order_currency,
                customer_details: response.data.customer_details
            }
        });

    } catch (error: any) {
        console.error('Cashfree verify payment error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.response?.data || error.message
        });
    }
};

// Handle Webhook
export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const webhookData = req.body;
        
        console.log('Cashfree Webhook received:', webhookData);
        
        // Verify webhook signature if needed
        // const signature = req.headers['x-webhook-signature'];
        
        // Process webhook data based on event type
        const { type, data } = webhookData;
        
        switch (type) {
            case 'PAYMENT_SUCCESS_WEBHOOK':
                console.log('Payment successful:', data);
                // Handle successful payment
                break;
            case 'PAYMENT_FAILED_WEBHOOK':
                console.log('Payment failed:', data);
                // Handle failed payment
                break;
            case 'PAYMENT_USER_DROPPED_WEBHOOK':
                console.log('Payment dropped by user:', data);
                // Handle user dropped payment
                break;
            default:
                console.log('Unknown webhook type:', type);
        }
        
        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error: any) {
        console.error('Cashfree webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process webhook',
            error: error.message
        });
    }
};

// Refund Payment
export const refundPayment = async (req: Request, res: Response) => {
    try {
        const { orderId, refundAmount, refundNote } = req.body;

        if (!orderId || !refundAmount) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and refund amount are required'
            });
        }

        const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const requestData = {
            refund_amount: parseFloat(refundAmount),
            refund_id: refundId,
            refund_note: refundNote || 'Refund processed'
        };

        const response = await axios.post(
            `${getCashfreeBaseURL()}/orders/${orderId}/refunds`,
            requestData,
            { headers: getCashfreeHeaders() }
        );
        
        res.status(200).json({
            success: true,
            message: 'Refund initiated successfully',
            data: response.data
        });

    } catch (error: any) {
        console.error('Cashfree refund error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate refund',
            error: error.response?.data || error.message
        });
    }
};

// Get Refund Status
export const getRefundStatus = async (req: Request, res: Response) => {
    try {
        const { orderId, refundId } = req.params;

        if (!orderId || !refundId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and Refund ID are required'
            });
        }

        const response = await axios.get(
            `${getCashfreeBaseURL()}/orders/${orderId}/refunds/${refundId}`,
            { headers: getCashfreeHeaders() }
        );
        
        res.status(200).json({
            success: true,
            message: 'Refund status fetched successfully',
            data: response.data
        });

    } catch (error: any) {
        console.error('Cashfree get refund status error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch refund status',
            error: error.response?.data || error.message
        });
    }
};
