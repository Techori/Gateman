import axios from "axios";
import { store } from "../app/store";

const backendUrl =
    import.meta.env.VITE_MODE === "development"
        ? "http://localhost:3004"
        : import.meta.env.VITE_BACKEND_URL;

const api = axios.create({
    baseURL: backendUrl,
    headers: {
        'Content-Type': 'application/json'
    }
})

api.interceptors.request.use((config) => {
    const state = store.getState();
    const { accessToken, refreshToken } = state.auth;
    let sessionAccessToken
    let sessionRefreshToken
    // add logic for insert  sessionToken inplace of stateToken if !token not found
    console.log("accessToken, refreshToken", accessToken, refreshToken);
    if (!accessToken) {
        const userSessionData = JSON.parse(sessionStorage.getItem('user') || `{}`)
        sessionAccessToken = userSessionData.accessToken
        sessionRefreshToken = userSessionData.refreshToken

        console.log("sessionAccessToken", sessionAccessToken)
    }
    if (accessToken && refreshToken) {
        config.headers.Authorization = accessToken;
        config.headers.refreshToken = refreshToken;
    } else {
        config.headers.Authorization = sessionAccessToken;
        config.headers.refreshToken = sessionRefreshToken;
    }
    if (!config.headers.Authorization) {
        console.warn('No authentication token found');
        
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

const login = async (data: { email: string; password: string }) => {
    const res = await api.post('/api/v1/users/login', data)
    return res.data
}

const createEmployee = async (data: { email: string; password: string }) => {
    const res = await api.post('/api/v1/users/createEmployee', data)
    return res.data
}

const logoutUser = async()=>{
    const res = await api.post('')
    return res.data
}
const fecthAllOwnerProperty = async (data:{page:number,limit:number})=>{
    const res = await api.post('/owner/all-properties',data)
    return res.data
}

const logoutUserBySessionId = async(data: { id: string;sessionId: string; })=>{
    const res = await api.post("/api/v1/users/logoutUserBySessionId",data)
    return res.data
}

const registerUser = async (data: { email: string; password: string; name: string; }) => {
    const res = await api.post('/api/v1/users/register', data)
    return res.data
}

// Create Property API function
const createProperty = async (formData: FormData) => {

    const response = await api.post(`/api/v1/properties/`, formData,{
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    
    return response.data;
};

// Get user properties
const getUserProperties = async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    verificationStatus?: string;
    type?: string;
}) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.verificationStatus) queryParams.append('verificationStatus', params.verificationStatus);
    if (params?.type) queryParams.append('type', params.type);

    const res = await api.get(`/api/v1/properties/user/my-properties?${queryParams.toString()}`);
    return res.data;
};

// Get property by ID
const getPropertyById = async (propertyId: string) => {
    const res = await api.get(`/api/v1/properties/${propertyId}`);
    return res.data;
};

// Get public properties (active and verified)
const getPublicProperties = async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    city?: string;
    state?: string;
    minCost?: number;
    maxCost?: number;
    amenities?: string | string[];
    seatingCapacity?: number;
}) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.type) queryParams.append('type', params.type);
    if (params?.city) queryParams.append('city', params.city);
    if (params?.state) queryParams.append('state', params.state);
    if (params?.minCost) queryParams.append('minCost', params.minCost.toString());
    if (params?.maxCost) queryParams.append('maxCost', params.maxCost.toString());
    if (params?.seatingCapacity) queryParams.append('seatingCapacity', params.seatingCapacity.toString());
    
    if (params?.amenities) {
        if (Array.isArray(params.amenities)) {
            params.amenities.forEach(amenity => queryParams.append('amenities', amenity));
        } else {
            queryParams.append('amenities', params.amenities);
        }
    }

    const res = await api.get(`/api/v1/properties/public?${queryParams.toString()}`);
    return res.data;
};

export {
    login,
    registerUser,
    createProperty,
    getUserProperties,
    getPropertyById,
    getPublicProperties,
    createEmployee,
    logoutUserBySessionId,
    fecthAllOwnerProperty
}