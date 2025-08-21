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

    return config;
}, (error) => {
    return Promise.reject(error);
});



const login = async (data: { email: string; password: string }) => {
    const res = await api.post('/api/v1/users/login', data)
    return res.data
}

const registerUser = async (data: { email: string; password: string; name: string; }) => {
    const res = await api.post('/api/v1/users/register', data)
    return res.data
}


export {
    login,
    registerUser
}