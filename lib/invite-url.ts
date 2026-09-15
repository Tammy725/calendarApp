export const INVITE_BASE_URL = 'https://vercel-redirect-plum-eight.vercel.app';

export function inviteLink(code: string): string {
  return `${INVITE_BASE_URL}/plan/${code}`;
}