export declare function getGoogleAuthUrl(redirectUri?: string): string;
export declare function getGoogleTokens(code: string, redirectUri?: string): Promise<import("google-auth-library").Credentials>;
export declare function getGoogleProfile(accessToken: string): Promise<{
    email: string;
    name: string;
    picture: string;
}>;
export declare function getAuthClient(accessToken: string, refreshToken?: string): import("google-auth-library").OAuth2Client;
//# sourceMappingURL=google-auth.d.ts.map