const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function equal(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0; for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function payloadFromToken(token, secret) {
  const [body, signature, ...extra] = token.split('.');
  if (!body || !signature || extra.length || !equal(await hmac(secret, body), bytes(signature))) throw new Error('invalid');
  const sealed = bytes(body); if (sealed.length < 29) throw new Error('invalid');
  const cipherAndTag = new Uint8Array(sealed.length - 28 + 16); cipherAndTag.set(sealed.slice(28)); cipherAndTag.set(sealed.slice(12, 28), sealed.length - 28);
  let payload;
  for (const namespace of ['cineseya', 'cinerusubs']) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${namespace}-download-encryption:${secret}`));
      const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, 12), tagLength: 128 }, key, cipherAndTag);
      payload = JSON.parse(decoder.decode(plain));
      break;
    } catch {
      // Try the legacy namespace so already-issued links remain valid during the rename.
    }
  }
  if (!payload) throw new Error('invalid');
  if (!payload.mediaVersionId || !payload.objectKey || !payload.exp || payload.exp * 1000 <= Date.now()) throw new Error('expired');
  return payload;
}

const worker = {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const token = new URL(request.url).pathname.match(/^\/v1\/files\/([^/]+)$/)?.[1];
    if (!token) return new Response('Not found', { status: 404 });
    try {
      const payload = await payloadFromToken(token, env.DOWNLOAD_SIGNING_SECRET);
      if (payload.bucket !== env.MEDIA_BUCKET_NAME) return new Response('Invalid bucket scope', { status: 403 });
      const object = await env.MEDIA_BUCKET.get(payload.objectKey, { range: request.headers });
      if (!object) return new Response('File removed', { status: 404 });
      const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(payload.fileName)}` });
      object.writeHttpMetadata(headers); headers.set('ETag', object.httpEtag);
      if (object.range) headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
      return new Response(request.method === 'HEAD' ? null : object.body, { status: object.range ? 206 : 200, headers });
    } catch (error) { return new Response(error instanceof Error && error.message === 'expired' ? 'Download token expired' : 'Invalid download token', { status: error instanceof Error && error.message === 'expired' ? 410 : 403, headers: { 'Cache-Control': 'no-store' } }); }
  },
};

export default worker;
