import winston, { format } from "winston";
import { config } from "./index.js";

const { combine, prettyPrint, timestamp, json } = format;

const logger = winston.createLogger({
    level: "info",
    format: combine(timestamp(), prettyPrint()),
    defaultMeta: {
        serviceName: "backend",
    },
    transports: [
        new winston.transports.Console({
            level: "info",
            // format: winston.format.json()
            format: combine(timestamp(), json(), prettyPrint()),
            silent: config.env === "test",
        }),
        // new winston.transports.File({
        //     level: "info",
        //     dirname: "logs",
        //     filename: "app.log",
        //     // format: winston.format.json()
        //     format: combine(timestamp(), json(), prettyPrint()),
        //     silent: Config.NODE_ENV === "test",
        // }),
        // new winston.transports.File({
        //     level: "error",
        //     dirname: "logs",
        //     filename: "error.log",
        //     // format: winston.format.json()
        //     format: combine(timestamp(), json(), prettyPrint()),
        //     silent: Config.NODE_ENV === "test",
        // }),
        // new winston.transports.File({
        //     level: "warn",
        //     dirname: "logs",
        //     filename: "warn.log",
        //     // format: winston.format.json()
        //     format: combine(timestamp(), json(), prettyPrint()),
        //     silent: Config.NODE_ENV === "test",
        // }),
    ],
});

export default logger;
