import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { getGoogleAuthUrl, getGoogleTokens, getGoogleProfile } from '../services/google-auth';

export const authRouter = Router();

authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing authorization code');
    }

    const tokens = await getGoogleTokens(code);
    const profile = await getGoogleProfile(tokens.access_token!);

    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatar: profile.picture,
        },
      });
    }

    const existingAccount = await prisma.calendarAccount.findFirst({
      where: { userId: user.id, provider: 'google', email: profile.email },
    });
    if (!existingAccount) {
      await prisma.calendarAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          email: profile.email,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    } else {
      await prisma.calendarAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || existingAccount.refreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    }

    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    const params = new URLSearchParams({
      token: jwtToken,
      userId: user.id,
      email: user.email,
      name: user.name || '',
      avatar: user.avatar || '',
    });
    res.redirect(`miapp://callback?${params}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

authRouter.post('/google/url', (req, res) => {
  const { redirectUri } = req.body;
  const url = getGoogleAuthUrl(redirectUri || undefined);
  res.json({ url });
});

authRouter.post('/google/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const tokens = await getGoogleTokens(code, redirectUri || undefined);
    const profile = await getGoogleProfile(tokens.access_token!);

    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatar: profile.picture,
        },
      });
    }

    const existingAccount = await prisma.calendarAccount.findFirst({
      where: { userId: user.id, provider: 'google', email: profile.email },
    });
    if (!existingAccount) {
      await prisma.calendarAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          email: profile.email,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    } else {
      await prisma.calendarAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || existingAccount.refreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    }

    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

authRouter.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { calendarAccounts: { select: { id: true, email: true, provider: true, lastSyncedAt: true } } },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
