import app from "./app.js";
import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// For Vercel, we need to export the app as a serverless function
// Don't use app.listen() in serverless environments

// For local development only
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening at port ${PORT}`);
  });
}

// Export the Express app for Vercel
export default app;
