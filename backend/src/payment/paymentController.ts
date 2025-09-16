import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import crypto from "crypto";

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

// Initiate Easebuzz Payment
export const initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      amount, 
      firstname, 
      lastname, 
      email, 
      phone, 
      productinfo,
      surl, // success URL
      furl, // failure URL
      udf1 = "",
      udf2 = "",
      udf3 = "",
      udf4 = "",
      udf5 = ""
    } = req.body;

    if (!amount || !firstname || !email || !phone || !productinfo) {
      return res.status(400).json({ 
        success: false, 
        message: "Required fields: amount, firstname, email, phone, productinfo" 
      });
    }

    const txnid = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    const paymentData = {
      key: easebuzzConfig.key,
      txnid,
      amount: amount.toString(),
      productinfo,
      firstname,
      lastname: lastname || "",
      email,
      phone,
      surl: surl || `${req.protocol}://${req.get('host')}/api/v1/payments/success`,
      furl: furl || `${req.protocol}://${req.get('host')}/api/v1/payments/failure`,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5
    };

    // Generate hash
    const hashString = `${paymentData.key}|${paymentData.txnid}|${paymentData.amount}|${paymentData.productinfo}|${paymentData.firstname}|${paymentData.email}|||||||||||${easebuzzConfig.salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const initiatePaymentUrl = `${easebuzzConfig.baseUrl[easebuzzConfig.env as 'test' | 'prod']}/payment/initiateLink`;
    
    // Make API call to Easebuzz
    const response = await fetch(initiatePaymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        ...paymentData,
        hash
      })
    });

    const result = await response.json();

    if (result.status === 1) {
      res.status(200).json({
        success: true,
        data: {
          access_key: result.data,
          payment_url: `${easebuzzConfig.baseUrl[easebuzzConfig.env as 'test' | 'prod']}/pay/${result.data}`,
          txnid,
          amount,
          hash
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error_desc || 'Payment initiation failed'
      });
    }

  } catch (error) {
    next(error);
  }
};

// Verify Payment Response
export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      easepayid,
      hash: receivedHash
    } = req.body;

    // Generate hash for verification
    const verifyHashString = `${easebuzzConfig.salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${easebuzzConfig.key}`;
    const generatedHash = crypto.createHash('sha512').update(verifyHashString).digest('hex');

    if (generatedHash !== receivedHash) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hash - payment verification failed'
      });
    }

    if (status === 'success') {
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          txnid,
          amount,
          easepayid,
          status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        data: {
          txnid,
          status
        }
      });
    }

  } catch (error) {
    next(error);
  }
};

// Get Payment Status
export const getPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { txnid } = req.params;

    if (!txnid) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    const statusData = {
      key: easebuzzConfig.key,
      txnid,
      amount: '1.00', // Dummy amount for status check
      email: 'test@example.com', // Dummy email for status check
    };

    const hashString = `${statusData.key}|${statusData.txnid}|${statusData.amount}|${statusData.email}|${easebuzzConfig.salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const statusUrl = `${easebuzzConfig.baseUrl[easebuzzConfig.env as 'test' | 'prod']}/transaction/v2.1/retrieve`;

    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...statusData,
        hash
      })
    });

    const result = await response.json();

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
};

// Generate Payment Link
export const generatePaymentLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      amount,
      firstname,
      lastname,
      email,
      phone,
      productinfo,
      address1,
      city,
      state,
      country,
      zipcode,
      expiry_date // Optional: link expiry date
    } = req.body;

    if (!amount || !firstname || !email || !phone || !productinfo) {
      return res.status(400).json({
        success: false,
        message: "Required fields: amount, firstname, email, phone, productinfo"
      });
    }

    const txnid = `LINK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const linkData = {
      key: easebuzzConfig.key,
      txnid,
      amount: amount.toString(),
      productinfo,
      firstname,
      lastname: lastname || "",
      email,
      phone,
      address1: address1 || "",
      city: city || "",
      state: state || "",
      country: country || "India",
      zipcode: zipcode || "",
      expiry_date: expiry_date || "" // Format: YYYY-MM-DD HH:MM:SS
    };

    // Generate hash for payment link
    const hashString = `${linkData.key}|${linkData.txnid}|${linkData.amount}|${linkData.productinfo}|${linkData.firstname}|${linkData.email}|${linkData.phone}|${linkData.address1}|${linkData.city}|${linkData.state}|${linkData.country}|${linkData.zipcode}|${easebuzzConfig.salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const paymentLinkUrl = `${easebuzzConfig.baseUrl[easebuzzConfig.env as 'test' | 'prod']}/payment/generateLink`;

    const response = await fetch(paymentLinkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...linkData,
        hash
      })
    });

    const result = await response.json();

    if (result.status === 1) {
      res.status(200).json({
        success: true,
        data: {
          payment_link: result.data.payment_url,
          txnid,
          amount,
          expires_at: expiry_date
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error_desc || 'Payment link generation failed'
      });
    }

  } catch (error) {
    next(error);
  }
};

// Handle Payment Success (Webhook/Redirect)
export const handlePaymentSuccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Payment Success:', req.body);
    // Process successful payment
    // Update your database, send confirmation emails, etc.
    
    res.status(200).json({
      success: true,
      message: 'Payment completed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Handle Payment Failure (Webhook/Redirect)
export const handlePaymentFailure = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Payment Failure:', req.body);
    // Process failed payment
    // Update your database, notify user, etc.
    
    res.status(200).json({
      success: false,
      message: 'Payment failed'
    });
  } catch (error) {
    next(error);
  }
};
