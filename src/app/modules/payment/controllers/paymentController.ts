import { Response } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../../../../types/express";
import * as paymentService from "../services/paymentService";

export const createPaymentController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { plan, paymentMethod } = req.body;

    // Define price based on plan
    const planAmount = plan === "Basic" ? 10 : plan === "Standard" ? 30 : 50;

    const payment = await paymentService.createPayment({
      user: new Types.ObjectId(req.user.id),
      plan,
      amount: planAmount,
      status: "Pending",
      paymentMethod
    });

    // Here you can integrate with SSLCommerz/Stripe API
    // and return payment gateway URL or token
    res.status(201).json({ success: true, data: payment, message: "Payment initiated" });

  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getPaymentsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const payments = await paymentService.getUserPayments(req.user.id);
    res.status(200).json({ success: true, data: payments });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};
