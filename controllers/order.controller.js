import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Stripe from "stripe";
// Place order COD: /api/order/place
export const placeOrderCOD = async (req, res) => {
    try {
      const userId = req.user;
      const { items, address } = req.body;
      if (!address || !items || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Invalid order details", success: false });
      }
      // calculate amount using items;
      let amount = await items.reduce(async (acc, item) => {
        const product = await Product.findById(item.product);
        return (await acc) + product.offerPrice * item.quantity;
      }, 0);
  
      // Add tex charfe 2%
      amount += Math.floor((amount * 2) / 100);
      await Order.create({
        userId,
        items,
        address,
        amount,
        paymentType: "COD",
        isPaid: false,
      });
      res
        .status(201)
        .json({ message: "Order placed successfully", success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
// Place order stripe: /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    try {
        const userId = req.user;
        const { items, address } = req.body;
        const origin = req.headers.origin || 'http://localhost:3000';
        
        if (!items || !address || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                message: "Invalid order details", 
                success: false 
            });
        }

        // Calculate total amount and prepare line items
        let amount = 0;
        const line_items = [];
        
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(400).json({
                    message: `Product not found: ${item.product}`,
                    success: false
                });
            }
            
            const itemTotal = product.offerPrice * item.quantity;
            amount += itemTotal;
            
            line_items.push({
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: product.name,
                    },
                    unit_amount: Math.round(product.offerPrice * 100), // Convert to paisa
                },
                quantity: item.quantity,
            });
        }
        
        // Add 2% tax
        amount += Math.floor((amount * 2) / 100);
        
        // Create order in database (initially not paid)
        const order = await Order.create({
            userId,
            items,
            address,
            amount,
            paymentType: "Online",
            isPaid: false, // Will be updated via webhook
        });
        
        // Initialize Stripe
        const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        // Create Stripe checkout session
        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${origin}/loader?next=/my-orders`,
            cancel_url: `${origin}/cart`,
            metadata: {
                orderId: order._id.toString(),
                userId: userId.toString(),
            },
            client_reference_id: order._id.toString(),
        });
        
        // Return the checkout URL to the client
        res.status(200).json({ 
            success: true, 
            url: session.url,
            orderId: order._id
        });
        
    } catch (error) {
        console.error('Error in placeOrderStripe:', error);
        res.status(500).json({ 
            message: error.message || 'Internal Server Error',
            success: false
        });
    }
};
  
  // oredr details for individual user :/api/order/user
  export const getUserOrders = async (req, res) => {
    try {
      const userId = req.user;
      const orders = await Order.find({
        userId,
        $or: [{ paymentType: "COD" }, { isPaid: true }],
      })
        .populate("items.product address")
        .sort({ createdAt: -1 });
      res.status(200).json({ success: true, orders });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
  // Get orders for specific seller :/api/order/seller
  export const getSellerOrders = async (req, res) => {
    try {
      const sellerId = req.user;
      
      // Find all orders that have at least one product from this seller
      const orders = await Order.find({
        'items.product': { 
          $in: await Product.find({ seller: sellerId }).distinct('_id') 
        },
        $or: [{ paymentType: 'COD' }, { isPaid: true }]
      })
        .populate('items.product address')
        .sort({ createdAt: -1 });
        
      res.status(200).json({ success: true, orders });
    } catch (error) {
      console.error('Error in getSellerOrders:', error);
      res.status(500).json({ 
        message: 'Internal Server Error',
        success: false 
      });
    }
  };

  // get all orders for admin :/api/order/all
  export const getAllOrders = async (req, res) => {
    try {
      const orders = await Order.find({
        $or: [{ paymentType: "COD" }, { isPaid: true }],
      })
        .populate("items.product address")
        .sort({ createdAt: -1 });
      res.status(200).json({ success: true, orders });
    } catch (error) {
      res.status(500).json({ 
        message: error.message || 'Internal Server Error',
        success: false 
      });
    }
  };

  // Handle Stripe webhook events
  export const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      try {
        // Update the order status in your database
        await Order.findByIdAndUpdate(session.metadata.orderId, {
          isPaid: true,
          paidAt: new Date(),
          paymentId: session.payment_intent
        });
        
        console.log(`Order ${session.metadata.orderId} has been paid.`);
      } catch (err) {
        console.error('Error updating order status:', err);
        return res.status(400).send('Webhook Error: Failed to update order status');
      }
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  };