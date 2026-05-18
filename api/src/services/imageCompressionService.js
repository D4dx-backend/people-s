const sharp = require('sharp');

const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/tiff', 'image/heic', 'image/heif', 'image/avif'
]);

const MAX_WIDTH = 1920;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 80;
const PNG_QUALITY = 85;

/**
 * Returns true if the mimetype is a compressible image.
 */
function isImageMime(mimetype) {
  return IMAGE_MIMES.has((mimetype || '').toLowerCase());
}

/**
 * Compress an image buffer using sharp.
 * - Resizes to MAX_WIDTH if wider.
 * - PNG → stays PNG with palette compression.
 * - HEIC/TIFF/AVIF → converted to JPEG.
 * - JPEG → compressed with mozjpeg.
 * - WebP → compressed with quality reduction.
 * - Animated GIF → returned as-is (sharp can't handle animations reliably).
 *
 * @param {Buffer} buffer     Original file buffer
 * @param {string} mimetype   Original mimetype (e.g. 'image/jpeg')
 * @returns {Promise<{ buffer: Buffer, mimetype: string, ext: string }>}
 */
async function compressImageBuffer(buffer, mimetype) {
  const mime = (mimetype || '').toLowerCase();

  // GIF: return untouched
  if (mime === 'image/gif') {
    return { buffer, mimetype: mime, ext: 'gif' };
  }

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Resize if too wide
  if (metadata.width && metadata.width > MAX_WIDTH) {
    image.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  let outputMimetype;
  let outputExt;

  if (mime === 'image/png') {
    image.png({ quality: PNG_QUALITY, compressionLevel: 8, adaptiveFiltering: true });
    outputMimetype = 'image/png';
    outputExt = 'png';
  } else if (mime === 'image/webp') {
    image.webp({ quality: WEBP_QUALITY });
    outputMimetype = 'image/webp';
    outputExt = 'webp';
  } else {
    // JPEG, HEIC, TIFF, AVIF, unknown images → output as JPEG
    image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    outputMimetype = 'image/jpeg';
    outputExt = 'jpg';
  }

  const compressedBuffer = await image.toBuffer();
  return { buffer: compressedBuffer, mimetype: outputMimetype, ext: outputExt };
}

module.exports = { isImageMime, compressImageBuffer };
