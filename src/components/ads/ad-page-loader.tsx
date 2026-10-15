import { headers } from 'next/headers';
import { AdSenseLoader } from './ad-sense-loader';

export async function AdPageLoader({ enabled, publisherId }: { enabled: boolean; publisherId?: string }) {
  if (!enabled || !publisherId) return null;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <AdSenseLoader enabled publisherId={publisherId} nonce={nonce}/>;
}
