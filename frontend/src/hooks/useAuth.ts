// import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "../app/store"
import { addUserDetails } from "../features/auth/authSlice"
import { useNavigate, useLocation } from "react-router"
import { useEffect } from "react"

const useAuth = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const userData = useSelector((state: RootState) => state.auth)
    const dispatch = useDispatch()

    useEffect(() => {
        const checkAuth = () => {
            if (!userData.accessToken || !userData.isLogin) {
                const userSessionData = JSON.parse(sessionStorage.getItem('user') || `{}`)
                if (userSessionData.accessToken) {
                    const { accessToken, refreshToken, id, name, email, role,
                        isEmailVerified,
                        sessionId, } = userSessionData
                    dispatch(
                        addUserDetails({
                            isLogin: true,
                            accessToken,
                            refreshToken,
                            userId: id,
                            useremail: email,
                            userName: name,
                            role,
                            isEmailVerified,
                            sessionId,
                        }))
                    navigate('/', { replace: true })

                } else {
                    // Only redirect to login if not already on an auth page
                    if (!location.pathname.startsWith('/auth')) {
                        navigate('/auth/login', { replace: true })
                    }
                }
            }
        }
        checkAuth()
    }, [dispatch, navigate, location.pathname, userData.accessToken, userData.isLogin])
}

export default useAuth