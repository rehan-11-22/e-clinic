import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

// Import app after env vars are loaded
import app from "./app.js";

// Configure Cloudinary only if needed (lazy load)
let cloudinary = null;

async function initializeCloudinary() {
  if (!cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
    const cloudinaryModule = await import("cloudinary");
    cloudinary = cloudinaryModule.default;

    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log("Cloudinary configured");
  }
}

// Initialize cloudinary in background (non-blocking)
initializeCloudinary().catch((err) => {
  console.warn("Cloudinary initialization failed:", err.message);
});

// For local development only
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening at port ${PORT}`);
  });
}

// Export for Vercel
export default app;
