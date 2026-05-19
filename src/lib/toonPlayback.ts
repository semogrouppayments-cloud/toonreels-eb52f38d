export type PlaybackQuality = 'auto' | 'high' | 'medium';
export type ToonVariantKey = 'tiny' | 'low' | 'medium' | 'high' | 'original';

export interface ToonVariantSource {
  url: string;
  width?: number;
  height?: number;
  bitrate?: number;
  mimeType?: string;
}

export type ToonVideoVariants = Partial<Record<ToonVariantKey, string | ToonVariantSource>> & {
  sources?: ToonVariantSource[];
};

interface ChooseToonSourceOptions {
  originalUrl: string;
  variants?: unknown;
  quality: PlaybackQuality;
  saveData: boolean;
  isSlowConnection: boolean;
  isTouchDevice: boolean;
  isStandalonePwa: boolean;
}

const VARIANT_ORDER: ToonVariantKey[] = ['tiny', 'low', 'medium', 'high', 'original'];

const isVariantSource = (value: unknown): value is ToonVariantSource =>
  Boolean(value && typeof value === 'object' && typeof (value as ToonVariantSource).url === 'string');

export const normalizeToonVariants = (variants?: unknown): ToonVideoVariants => {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) {
    return {};
  }

  return variants as ToonVideoVariants;
};

const readVariant = (variants: ToonVideoVariants, key: ToonVariantKey): ToonVariantSource | null => {
  const value = variants[key];
  if (typeof value === 'string' && value.trim()) {
    return { url: value };
  }
  if (isVariantSource(value)) {
    return value;
  }
  return null;
};

const firstAvailable = (variants: ToonVideoVariants, keys: ToonVariantKey[], originalUrl: string): ToonVariantSource => {
  for (const key of keys) {
    const source = key === 'original' ? readVariant(variants, 'original') || { url: originalUrl } : readVariant(variants, key);
    if (source?.url) return source;
  }

  const sortedSources = Array.isArray(variants.sources)
    ? variants.sources.filter(isVariantSource).sort((a, b) => (a.bitrate || a.width || 0) - (b.bitrate || b.width || 0))
    : [];

  return sortedSources[0] || { url: originalUrl };
};

export const chooseToonPlaybackSource = ({
  originalUrl,
  variants,
  quality,
  saveData,
  isSlowConnection,
  isTouchDevice,
  isStandalonePwa,
}: ChooseToonSourceOptions): ToonVariantSource => {
  const normalized = normalizeToonVariants(variants);
  const shouldPreferLight = saveData || isSlowConnection || isStandalonePwa || isTouchDevice;

  if (quality === 'medium') {
    return firstAvailable(normalized, ['low', 'tiny', 'medium', 'original'], originalUrl);
  }

  if (quality === 'high') {
    return firstAvailable(normalized, ['high', 'original', 'medium', 'low', 'tiny'], originalUrl);
  }

  if (shouldPreferLight) {
    return firstAvailable(normalized, ['low', 'tiny', 'medium', 'original'], originalUrl);
  }

  return firstAvailable(normalized, ['high', 'original', 'medium', 'low', 'tiny'], originalUrl);
};

export const chooseToonPreloadSource = (
  originalUrl: string,
  variants: unknown,
  isConstrained: boolean,
): string => {
  const source = chooseToonPlaybackSource({
    originalUrl,
    variants,
    quality: isConstrained ? 'medium' : 'auto',
    saveData: isConstrained,
    isSlowConnection: isConstrained,
    isTouchDevice: isConstrained,
    isStandalonePwa: isConstrained,
  });

  return source.url;
};

export const variantKeysWithFallback = (variants: unknown, originalUrl: string): string[] => {
  const normalized = normalizeToonVariants(variants);
  const urls = new Set<string>();

  VARIANT_ORDER.forEach((key) => {
    const source = readVariant(normalized, key);
    if (source?.url) urls.add(source.url);
  });

  if (Array.isArray(normalized.sources)) {
    normalized.sources.filter(isVariantSource).forEach((source) => urls.add(source.url));
  }

  urls.add(originalUrl);
  return Array.from(urls);
};
