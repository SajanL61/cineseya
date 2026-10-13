export function buildShareTargets(title: string, canonicalUrl: string) {
  const message = `${title} — CineSeya.lk`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message}\n${canonicalUrl}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(message)}`,
  };
}
