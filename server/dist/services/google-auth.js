"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleAuthUrl = getGoogleAuthUrl;
exports.getGoogleTokens = getGoogleTokens;
exports.getGoogleProfile = getGoogleProfile;
exports.getAuthClient = getAuthClient;
const googleapis_1 = require("googleapis");
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'openid',
    'profile',
    'email',
];
function getGoogleAuthUrl(redirectUri) {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
}
async function getGoogleTokens(code, redirectUri) {
    const { tokens } = await oauth2Client.getToken({
        code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
    oauth2Client.setCredentials(tokens);
    return tokens;
}
async function getGoogleProfile(accessToken) {
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data;
}
function getAuthClient(accessToken, refreshToken) {
    const client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    return client;
}
//# sourceMappingURL=google-auth.js.map