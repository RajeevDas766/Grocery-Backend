import express from 'express';
import { authUser } from './../middlewares/authUser.js';
import { getAllOrders, getUserOrders, placeOrderCOD, getSellerOrders, placeOrderStripe, handleStripeWebhook } from './../controllers/order.controller.js';
import { authSeller } from './../middlewares/authSeller.js';
import bodyParser from 'body-parser';

const router = express.Router();
router.post("/cod", authUser, placeOrderCOD);
router.post("/stripe", authUser, placeOrderStripe);
router.get("/user", authUser, getUserOrders);
router.get("/seller", authSeller, getSellerOrders);

// Stripe webhook - must be before body parser
router.post('/webhook', 
  bodyParser.raw({ type: 'application/json' }), 
  handleStripeWebhook
);

export default router;