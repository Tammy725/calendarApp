import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'openid',
  'profile',
  'email',
];

export function getGoogleAuthUrl(redirectUri?: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
}

export async function getGoogleTokens(code: string, redirectUri?: string) {
  const { tokens } = await oauth2Client.getToken({
    code,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  oauth2Client.setCredentials(tokens);
  return tokens;
}

export async function getGoogleProfile(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data as { email: string; name: string; picture: string };
}

export function getAuthClient(accessToken: string, refreshToken?: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return client;
}
