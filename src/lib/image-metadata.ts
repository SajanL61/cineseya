import type { ArtworkMetadata } from '@/lib/artwork';

const typeAliases: Record<string, string> = { 'image/jpg': 'image/jpeg' };
const normalizedType = (value: string) => typeAliases[value.toLocaleLowerCase()] ?? value.toLocaleLowerCase();
const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
const u16be = (bytes: Uint8Array, offset: number) => (bytes[offset]! << 8) | bytes[offset + 1]!;
const u24le = (bytes: Uint8Array, offset: number) => bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
const u32be = (bytes: Uint8Array, offset: number) => ((bytes[offset]! * 0x1000000) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!) >>> 0;

function jpegOrientation(bytes: Uint8Array, start: number, length: number) {
  if (length < 14 || ascii(bytes, start, 6) !== 'Exif\0\0') return 1;
  const tiff = start + 6;
  const little = ascii(bytes, tiff, 2) === 'II';
  if (!little && ascii(bytes, tiff, 2) !== 'MM') return 1;
  const read16 = (offset: number) => little ? bytes[offset]! | (bytes[offset + 1]! << 8) : u16be(bytes, offset);
  const read32 = (offset: number) => little
    ? (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0
    : u32be(bytes, offset);
  const ifd = tiff + read32(tiff + 4);
  if (ifd + 2 > start + length) return 1;
  const count = read16(ifd);
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > start + length) break;
    if (read16(entry) === 0x0112) return read16(entry + 8);
  }
  return 1;
}

function inspectJpeg(bytes: Uint8Array) {
  let offset = 2;
  let orientation = 1;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = u16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (marker === 0xe1) orientation = jpegOrientation(bytes, offset + 2, length - 2);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      let height = u16be(bytes, offset + 3);
      let width = u16be(bytes, offset + 5);
      if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
      return { width, height };
    }
    offset += length;
  }
  return undefined;
}

function inspectWebp(bytes: Uint8Array) {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const size = bytes[offset + 4]! | (bytes[offset + 5]! << 8) | (bytes[offset + 6]! << 16) | (bytes[offset + 7]! << 24);
    const data = offset + 8;
    if (chunk === 'VP8X' && data + 10 <= bytes.length) return { width: u24le(bytes, data + 4) + 1, height: u24le(bytes, data + 7) + 1 };
    if (chunk === 'VP8L' && data + 5 <= bytes.length && bytes[data] === 0x2f) return {
      width: 1 + (bytes[data + 1]! | ((bytes[data + 2]! & 0x3f) << 8)),
      height: 1 + ((bytes[data + 2]! >> 6) | (bytes[data + 3]! << 2) | ((bytes[data + 4]! & 0x0f) << 10)),
    };
    if (chunk === 'VP8 ' && data + 10 <= bytes.length && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) return {
      width: (bytes[data + 6]! | (bytes[data + 7]! << 8)) & 0x3fff,
      height: (bytes[data + 8]! | (bytes[data + 9]! << 8)) & 0x3fff,
    };
    offset = data + size + (size % 2);
  }
  return undefined;
}

function inspectAvif(bytes: Uint8Array) {
  for (let offset = 4; offset + 16 <= bytes.length; offset++) {
    if (ascii(bytes, offset, 4) !== 'ispe') continue;
    const boxStart = offset - 4;
    const size = u32be(bytes, boxStart);
    if (size >= 20 && boxStart + size <= bytes.length) return { width: u32be(bytes, offset + 8), height: u32be(bytes, offset + 12) };
  }
  return undefined;
}

export function inspectImageBytes(bytes: Uint8Array, declaredMimeType: string, fileSize = bytes.byteLength): ArtworkMetadata {
  let mimeType = '';
  let dimensions: { width: number; height: number } | undefined;
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    mimeType = 'image/png'; dimensions = { width: u32be(bytes, 16), height: u32be(bytes, 20) };
  } else if (bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mimeType = 'image/jpeg'; dimensions = inspectJpeg(bytes);
  } else if (bytes.length >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    mimeType = 'image/webp'; dimensions = inspectWebp(bytes);
  } else if (bytes.length >= 24 && ascii(bytes, 4, 4) === 'ftyp' && ['avif','avis'].some((brand) => ascii(bytes, 8, Math.min(64, bytes.length - 8, Math.max(0, u32be(bytes, 0) - 8))).includes(brand))) {
    mimeType = 'image/avif'; dimensions = inspectAvif(bytes);
  }
  if (!mimeType || !dimensions?.width || !dimensions.height) throw Object.assign(new Error('The uploaded file is not a valid supported image.'), { status: 422, code: 'INVALID_IMAGE' });
  if (normalizedType(declaredMimeType) !== mimeType) throw Object.assign(new Error('The image contents do not match the declared file type.'), { status: 422, code: 'IMAGE_TYPE_MISMATCH' });
  return { ...dimensions, aspectRatio: dimensions.width / dimensions.height, mimeType, fileSize };
}
