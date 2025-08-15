export interface Users {
    _id: string;
    name: string;
    email: string;
    password: string;
    refreshToken?: string;
    isLogin: boolean;
    isEmailVerify: boolean;
    role: string;
    phoneNumber: string;
    status: string;
    otp: number;
    otpExpiresAt: Date;
    isPasswordCorrect(password: string): Promise<boolean>;
    generateAccessToken(): string;
    generateRefreshToken(): string;
    createdAt: string;
}
