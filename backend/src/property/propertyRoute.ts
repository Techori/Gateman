import express from "express";
import authenticate, { optionalAuth } from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 
    createProperty, 
    getPropertyById, 
    getUserProperties,
    getAllPropertiesForAdminRole,
    getAllPropertyForActiveAndVerified
} from "./propertyController.js";

const propertyRoute = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const upload = multer({
    dest: path.resolve(process.cwd(), "public/data/uploads"),
    limits: { 
        fileSize: 4 * 1024 * 1024, // 4MB per file
        files: 5 // Maximum 5 files
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Public routes (no authentication required)
// Get all active and verified properties (for public browsing)
propertyRoute.get("/public", getAllPropertyForActiveAndVerified);

// Get property by ID (public can view verified properties)
propertyRoute.get("/:propertyId", getPropertyById);

// Protected routes (authentication required)
// Create new property (only property owners)
propertyRoute.post(
    "/", 
    authenticate, 
    upload.fields([{ name: "propertyImage", maxCount: 5 }]), 
    createProperty
);

// Get all properties for authenticated user
propertyRoute.get("/user/my-properties", authenticate, getUserProperties);

// Admin routes (admin authentication required)
// Get all properties for admin role
propertyRoute.get("/admin/all", authenticate, getAllPropertiesForAdminRole);

export default propertyRoute;