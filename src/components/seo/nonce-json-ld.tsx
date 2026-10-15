import { headers } from 'next/headers';

export async function NonceJsonLd({ value }: { value: unknown }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replaceAll('<', '\\u003c') }} />;
}
