export type ImageCompressionResult = {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  quality: number;
  compressed: boolean;
};

const TARGET_BYTES = 500 * 1024;
const MAX_LONG_EDGE = 1800;
const MIN_LONG_EDGE = 960;
const START_QUALITY = 0.9;
const MIN_QUALITY = 0.68;
const QUALITY_STEP = 0.055;
const SCALE_STEP = 0.86;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode this image."));
    }, type, quality);
  });
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the HTMLImageElement decoder for older browsers.
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image format could not be read by the browser."));
    };
    image.src = url;
  });
}

function getImageSize(image: ImageBitmap | HTMLImageElement) {
  if (image instanceof ImageBitmap) {
    return { width: image.width, height: image.height };
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

function scaledDimensions(width: number, height: number, maxLongEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function webpFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-") || "specimen-photo";
  return `${base}.webp`;
}

/**
 * Compresses a specimen photo in the browser before it reaches Appwrite.
 * It keeps a high WebP quality first, then lowers quality and dimensions only
 * when necessary to approach the storage target.
 */
export async function compressSpecimenImage(file: File): Promise<ImageCompressionResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const decoded = await decodeImage(file);
  const original = getImageSize(decoded);
  let output = scaledDimensions(original.width, original.height, MAX_LONG_EDGE);
  let bestBlob: Blob | null = null;
  let usedQuality = START_QUALITY;

  try {
    while (true) {
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Image compression is unavailable in this browser.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded, 0, 0, output.width, output.height);

      let quality = START_QUALITY;
      let blob = await canvasToBlob(canvas, "image/webp", quality);
      bestBlob = blob;
      usedQuality = quality;

      while (blob.size > TARGET_BYTES && quality - QUALITY_STEP >= MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
        blob = await canvasToBlob(canvas, "image/webp", quality);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
          usedQuality = quality;
        }
      }

      if ((bestBlob?.size ?? 0) <= TARGET_BYTES || Math.max(output.width, output.height) <= MIN_LONG_EDGE) {
        break;
      }

      output = {
        width: Math.max(1, Math.round(output.width * SCALE_STEP)),
        height: Math.max(1, Math.round(output.height * SCALE_STEP)),
      };
    }
  } finally {
    if (decoded instanceof ImageBitmap) decoded.close();
  }

  if (!bestBlob) throw new Error("The image could not be compressed.");

  // Keep an already-small original when re-encoding would not save meaningful space.
  const meaningfulSaving = bestBlob.size < file.size * 0.96;
  if (!meaningfulSaving && file.size <= TARGET_BYTES && Math.max(original.width, original.height) <= MAX_LONG_EDGE) {
    return {
      file,
      originalBytes: file.size,
      compressedBytes: file.size,
      originalWidth: original.width,
      originalHeight: original.height,
      outputWidth: original.width,
      outputHeight: original.height,
      quality: 1,
      compressed: false,
    };
  }

  const compressedFile = new File([bestBlob], webpFilename(file.name), {
    type: "image/webp",
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalBytes: file.size,
    compressedBytes: compressedFile.size,
    originalWidth: original.width,
    originalHeight: original.height,
    outputWidth: output.width,
    outputHeight: output.height,
    quality: usedQuality,
    compressed: true,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
