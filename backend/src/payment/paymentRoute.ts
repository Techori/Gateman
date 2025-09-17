import express from "express";
import { 
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
  generatePaymentLink,
  handlePaymentSuccess,
  handlePaymentFailure
} from "./paymentController.js";

const router = express.Router();

// Core payment routes
router.post("/initiate", initiatePayment);
router.post("/verify", verifyPayment);
router.get("/status/:txnid", getPaymentStatus);

// Payment link generation
router.post("/generate-link", generatePaymentLink);

// Webhook/Redirect handlers
router.post("/success", handlePaymentSuccess);
router.post("/failure", handlePaymentFailure);

export default router;
