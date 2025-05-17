import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { z } from 'zod';
import { selectUserSchema } from '../../lib/domain/schema';

export const SessionUserSchema = z.object({
  dbId: selectUserSchema.shape.id,
  name: selectUserSchema.shape.name.unwrap().optional(),
  email: selectUserSchema.shape.email.unwrap().optional(),
  image: selectUserSchema.shape.image.unwrap().optional(),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export const getAuthenticatedSessionUser = async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const parsed = SessionUserSchema.safeParse(user);
  if (!parsed.success) return null;
  return parsed.data;
};
