import { z } from 'zod';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createSession } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { hashPassword, verifyPassword } from '@/lib/security';
import { AuditLog, User } from '@/models';

const schema = z.object({ email: z.email().max(254).transform((value) => value.trim().toLowerCase()), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'auth-login', 8, 15 * 60_000);
    if (useDemoData) throw Object.assign(new Error('Account sign-in is available after connecting the isolated CineSeya.lk database.'), { status: 503, code: 'DATABASE_REQUIRED' });
    const input = schema.parse(await request.json());
    await connectDb();
    const user = await User.findOne({ email: input.email }).select('+passwordHash');
    const passwordHash = user?.passwordHash ? String(user.passwordHash) : await hashPassword('cineseya-invalid-login-placeholder');
    const valid = await verifyPassword(passwordHash, input.password);
    if (!user || !valid || !user.active) throw Object.assign(new Error('The email or password is incorrect.'), { status: 401, code: 'INVALID_CREDENTIALS' });
    user.lastLoginAt = new Date();
    await user.save();
    await createSession(String(user._id), request);
    await AuditLog.create({ actor: user._id, action: 'auth.login', entity: 'User', entityId: String(user._id) });
    return Response.json({ user: { id: String(user._id), name: user.displayName || user.name, role: user.role } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
