import 'server-only';
import { connectDb } from '@/lib/db';
import { TranslatorProfile, User } from '@/models';

export type TranslatorUserOption = {
  id: string;
  label: string;
  email: string;
  role: string;
};

export async function getAdminTranslatorProfile(id: string) {
  await connectDb();
  const profile = await TranslatorProfile.findById(id)
    .select('displayName slug bio avatarUrl user verified totalSubtitles totalDownloads averageRating createdAt updatedAt')
    .lean();
  return profile ? JSON.parse(JSON.stringify(profile)) as Record<string, unknown> : null;
}

export async function getTranslatorUserOptions(): Promise<TranslatorUserOption[]> {
  await connectDb();
  const users = await User.find({ active: true })
    .select('displayName name email role')
    .sort({ displayName: 1, name: 1 })
    .limit(500)
    .lean();
  return users.map((user) => ({
    id: String(user._id),
    label: String(user.displayName || user.name || user.email),
    email: String(user.email),
    role: String(user.role),
  }));
}
