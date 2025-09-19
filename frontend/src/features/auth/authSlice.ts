import { createSlice } from "@reduxjs/toolkit"
export interface AuthState {
    isLogin: boolean,
    refreshToken: string,
    accessToken: string,
    userId: string,
    userName: string,
    useremail: string,
    role: string,
    sessionId: string,
    isEmailVerified: boolean,
    userProfileUrl?: string,
    phoneNumber?: string
}
const initialState: AuthState = {
    isLogin: false,
    accessToken: "",
    refreshToken: "",
    userId: "",
    userName: "",
    useremail: "",
    role: "",
    sessionId: "",
    isEmailVerified: false,
    userProfileUrl: "",
    phoneNumber: ""
}

export const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        addUserDetails: (state, action) => {
            const { isLogin, accessToken, refreshToken, userId, useremail, userName, role, sessionId, isEmailVerified, userProfileUrl, phoneNumber } = action.payload
            state.isLogin = isLogin
            state.accessToken = accessToken
            state.refreshToken = refreshToken
            state.userId = userId
            state.userName = userName
            state.useremail = useremail
            state.role = role
            state.sessionId = sessionId
            state.isEmailVerified = isEmailVerified
            state.userProfileUrl = userProfileUrl
            state.phoneNumber = phoneNumber
        },
        updateAccessToken: (state, action) => {
            const { accessToken } = action.payload
            state.accessToken = accessToken
        },
        deleteUser: (state) => {
            state.isLogin = false
            state.accessToken = ""
            state.refreshToken = ""
            state.userId = ""
            state.userName = ""
            state.useremail = ""
            state.role = ""
            state.sessionId = ""
            state.isEmailVerified = false
        },
        updateUserProfileUrl: (state, action) => {
            const { userProfileUrl } = action.payload
            state.userProfileUrl = userProfileUrl
        }
    }
})

export const { addUserDetails, deleteUser, updateAccessToken, updateUserProfileUrl } = authSlice.actions
export default authSlice.reducer