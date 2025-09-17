import { Router } from 'express';
import {
    createPaymentOrder,
    getOrderStatus,
    getPaymentDetails,
    verifyPayment,
    handleWebhook,
    refundPayment,
    getRefundStatus
} from './cashfreeController.js';

const router = Router();

// Payment Order Routes
router.post('/create-order', createPaymentOrder);
router.get('/order-status/:orderId', getOrderStatus);
router.get('/payment-details/:orderId/:cfPaymentId', getPaymentDetails);

// Payment Verification
router.post('/verify-payment', verifyPayment);

// Webhook Handler
router.post('/webhook', handleWebhook);

// Refund Routes
router.post('/refund', refundPayment);
router.get('/refund-status/:orderId/:refundId', getRefundStatus);

export default router;
