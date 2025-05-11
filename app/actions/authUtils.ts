import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { z } from 'zod';

export const SessionUserSchema = z.object({
  dbId: z.number(),
  name: z.string().optional(),
  email: z.string().optional(),
  image: z.string().optional(),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export const getAuthenticatedSessionUser = async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const parsed = SessionUserSchema.safeParse(user);
  if (!parsed.success) return null;
  return parsed.data;
};
