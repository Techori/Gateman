import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProperty, getPropertyById, getUserProperties } from "./propertyController.js";

const propertyRoute = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// file store local
const upload = multer({
    dest: path.resolve(process.cwd(), "public/data/uploads"), // Use process.cwd() instead
    // limit 4mb max per file
    limits: { 
        fileSize: 4 * 1024 * 1024, // 4MB per file
        files: 5 // Maximum 5 files
    }
});

// create new property
propertyRoute.post("/", authenticate, upload.fields([{ name: "propertyImage", maxCount: 5 }]), createProperty);

// get property by ID
propertyRoute.get("/:propertyId", getPropertyById);

// get all properties for authenticated user
propertyRoute.get("/user", authenticate, getUserProperties);

export default propertyRoute;