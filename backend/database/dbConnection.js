import mongoose from "mongoose";

export const dbConnection = () => {
  mongoose
    .connect(
      "mongodb+srv://eclinic:eclinic@e-clinic.hdvka.mongodb.net/?retryWrites=true&w=majority&appName=e-clinic",
      {
        dbName: "e-clinic",
      }
    )
    .then(() => {
      console.log("Connected to database!");
    })
    .catch((err) => {
      console.log("Some error occured while connecting to database:", err);
    });
};
