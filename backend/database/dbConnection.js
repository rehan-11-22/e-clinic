import mongoose from "mongoose";

export const dbConnection = () => {
  const MONGO_URI =
    process.env.MONGO_URI ||
    "mongodb+srv://eclinic:eclinic@e-clinic.hdvka.mongodb.net/?retryWrites=true&w=majority&appName=e-clinic";

  mongoose
    .connect(MONGO_URI, {
      dbName: "e-clinic",
    })
    .then(() => {
      console.log("Connected to database!");
    })
    .catch((err) => {
      console.log("Some error occured while connecting to database:", err);
    });
};
