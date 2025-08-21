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
    type?: "DayPass" | "Meeting Room" | "Coworking Space" | "Managed Office" | "Virtual office" | "Office/Commercial" | "Community Hall";
    floorSize: number;
    totalFloor: number;
    cost: number;
    amenities: string[];
    isSaturdayOpened: boolean;
    isSundayOpened: boolean;
    seatingCapacity: number;
    totalCostPerSeat: number;
    isPriceNegotiable: boolean;
    unavailableDates: string[]; // Array of date strings in YYYY-MM-DD format
    furnishingLevel?: string;
    propertyStatus: "active" | "inactive" | "under_maintenance";
    verificationStatus: "verified" | "notVerified" | "pending";
    lastInspectionDate?: Date;
    adminNote?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PropertyOwner {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
}

export interface PropertyWithOwner extends Omit<PropertyProps, 'ownerId'> {
    ownerId: PropertyOwner;
}

export interface PropertyListResponse {
    success: boolean;
    data: {
        properties: PropertyProps[] | PropertyWithOwner[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalProperties: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        filters?: {
            type?: string | null;
            city?: string | null;
            state?: string | null;
            status?: string | null;
            verificationStatus?: string | null;
            minCost?: number | null;
            maxCost?: number | null;
            amenities?: string | string[] | null;
            seatingCapacity?: number | null;
        };
    };
}

export interface PropertyCreateRequest {
    name: string;
    description?: string;
    landmark?: string;
    address: string;
    city: string;
    state: string;
    pincode: number;
    googleMapLink?: string;
    totalArea?: number;
    type?: PropertyProps['type'];
    floorSize: number;
    totalFloor: number;
    cost: number;
    amenities: string[];
    isSaturdayOpened: boolean;
    isSundayOpened: boolean;
    seatingCapacity: number;
    totalCostPerSeat: number;
    isPriceNegotiable: boolean;
    unavailableDates?: string[];
    furnishingLevel?: string;
    propertyStatus?: PropertyProps['propertyStatus'];
    verificationStatus?: PropertyProps['verificationStatus'];
    lastInspectionDate?: string;
    adminNote?: string;
}