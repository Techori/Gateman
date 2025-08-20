export interface PropertyProps {
    _id: string;
    ownerId: string;   // Reference to User
    name: string;
    description?: string;
    propertyImages: string[];
    landmark?: string;
    address: string;
    city: string;
    state: string;
    pincode: number;
    googleMapLink?: string;
    totalArea?: number;
    type?: string;
    totalSpaces: number;
    amenities: string[];
    propertyStatus: "active" | "inactive" | "under_maintenance";
    verificationStatus: "verified" | "notVerified" | "pending";
    lastInspectionDate?: Date;
    adminNote?: string;

   
    createdAt: Date;
    updatedAt: Date;
}