import mongoose from "mongoose";
import logger from "./logger.js";
import { config } from "./index.js";

const connectDB = async () => {
    try {
        mongoose.connection.on("connected", () => {
            logger.info("Connected to database successfully");
        });
        mongoose.connection.on("error", (err) => {
            logger.error(`Error in connecting to database. ${err}`);
        });
        mongoose.connect(config.databaseUrl as string);
    } catch (err) {
        logger.error("Falied to connect to database.", err);
        process.exit(1);
    }
};
export default connectDB;
