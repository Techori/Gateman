export interface Users {
    _id: string;
    name: string;
    email: string;
    password: string;

    // Multi-session management
    sessions: UserSession[];

    // Legacy fields for backward compatibility
    refreshToken?: string;

    isLogin: boolean;
    isEmailVerify: boolean;
    role: string;
    phoneNumber: string;
    status: string;
    otp: number;
    otpExpiresAt: Date;

    // Session management methods
    createSession(deviceInfo?: any): {
        sessionId: string;
        refreshToken: string;
    };
    findSession(sessionId: string): UserSession | undefined;
    isSessionValid(sessionId: string): boolean;
    updateSessionActivity(
        sessionId: string
    ):
        | boolean
        | { extended: boolean; newRefreshToken?: string; newExpiresAt?: Date };
    removeSession(sessionId: string): boolean;
    removeSessionByRefreshToken(refreshToken: string): boolean;
    clearAllSessions(): void;
    validateRefreshToken(refreshToken: string): {
        valid: boolean;
        reason?: string;
        sessionId?: string;
        session?: UserSession;
    };
    getActiveSessions(): UserSession[];
    getSessionCount(): number;
    cleanExpiredSessions(): number;

    // Authentication methods
    isPasswordCorrect(password: string): Promise<boolean>;
    generateAccessToken(sessionId: string): string;

    createdAt: string;
    updatedAt: string;
}

export interface UserSession {
    sessionId: string;
    refreshToken: string;
    deviceInfo: {
        userAgent?: string;
        ipAddress?: string;
        deviceType?: string;
    };
    createdAt: Date;
    expiresAt: Date;
    lastActiveAt: Date;
}
