// Uses Sharp to generate both WebP sizes.
// Shared by local.ts, handler.ts and app/api/resize/route.ts.
import sharp from "sharp";

const SUPPORTED_FORMATS = ["jpeg", "png", "webp", "avif"] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export const isSupportedFormat = (format: string): format is SupportedFormat => {
  return SUPPORTED_FORMATS.includes(format as SupportedFormat);
};

export const SIZES = [
  { name: "large", width: 1200, quality: 80 },
  { name: "thumb", width: 400, quality: 75 },
] as const;

export type SizeName = (typeof SIZES)[number]["name"];

export interface ResizedImage {
  name: SizeName;
  width: number;
  height: number;
  bytes: number;
  buffer: Buffer;
}

export const resizeToWebp = async (imageBuffer: Buffer): Promise<ResizedImage[]> => {
  try {
    // One Sharp chain per size, run at the same time
    return await Promise.all(
      SIZES.map(async (size) => {
        const { data, info } = await sharp(imageBuffer)
          .rotate()
          .resize({ width: size.width, withoutEnlargement: true })
          .webp({ quality: size.quality })
          .toBuffer({ resolveWithObject: true });

        return {
          name: size.name,
          width: info.width,
          height: info.height,
          bytes: info.size,
          buffer: data,
        };
      }),
    );
  } catch (error) {
    // Re-throw with context so local.ts / route.ts / handler.ts can decide what to do
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`resizeToWebp failed: ${reason}`, { cause: error });
  }
};
