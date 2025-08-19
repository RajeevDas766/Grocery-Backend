import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { connectDB } from "./config/connectDB.js";
import { connectCloudinary } from "./config/cloudinary.js";

// Conditionally load environment variables for development only
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

// Import route handlers
import userRoutes from "./routes/user.routes.js";
import sellerRoutes from "./routes/seller.routes.js"
import productRoutes from "./routes/product.routes.js"
import cartRoutes from "./routes/cart.routes.js"
import orderRoutes from "./routes/order.routes.js"
import addressRoutes from "./routes/address.routes.js"

const app = express();

// Configure allowed origins for CORS
const allowedOrigins = [
    "http://localhost:5173",
    "https://grocery-frontend-beta-snowy.vercel.app"
];

// Connect to Cloudinary
connectCloudinary();

// Apply middleware
app.use(express.json());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());

// Serve static files (e.g., product images)
app.use("/images", express.static("uploads"));

// Define API routes
app.use("/api/user", userRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/product", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/address", addressRoutes);

// Connect to the database and then start the server
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
