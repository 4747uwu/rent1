// client/src/utils/canvasUtils.js
/**
 * Canvas utility for cropping images
 * Used by YouTube-style image cropper
 */

/**
 * Creates a canvas and draws the cropped image
 * @param {string} imageSrc - Base64 or URL of the source image
 * @param {Object} pixelCrop - The crop area in pixels {x, y, width, height}
 * @param {number} rotation - Rotation in degrees (optional)
 * @returns {Promise<Blob>} - The cropped image as a Blob
 */
export const getCroppedImg = (imageSrc, pixelCrop, rotation = 0) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const maxSize = Math.max(image.width, image.height);
      const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

      // Set canvas size to match the safe area
      canvas.width = safeArea;
      canvas.height = safeArea;

      // Translate canvas context to center
      ctx.translate(safeArea / 2, safeArea / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-safeArea / 2, -safeArea / 2);

      // Draw rotated image
      ctx.drawImage(
        image,
        safeArea / 2 - image.width * 0.5,
        safeArea / 2 - image.height * 0.5
      );

      const data = ctx.getImageData(0, 0, safeArea, safeArea);

      // Set canvas to final crop size
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      // Paste cropped area
      ctx.putImageData(
        data,
        Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
      );

      // Convert canvas to Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas is empty'));
          }
        },
        'image/png',
        1
      );
    };

    image.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
};

/**
 * Reads a file and returns it as a data URL
 * @param {File} file - The file to read
 * @returns {Promise<string>} - Data URL of the file
 */
export const readFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), false);
    reader.readAsDataURL(file);
  });
};

/**
 * Generates a preview URL for a Blob
 * @param {Blob} blob - The blob to generate URL for
 * @returns {string} - Object URL
 */
export const getBlobUrl = (blob) => {
  return URL.createObjectURL(blob);
};

/**
 * Validates aspect ratio of image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} expectedRatio - Expected aspect ratio
 * @param {number} tolerance - Tolerance for ratio matching (default 0.1)
 * @returns {boolean} - Whether ratio matches
 */
export const validateAspectRatio = (width, height, expectedRatio, tolerance = 0.1) => {
  const actualRatio = width / height;
  return Math.abs(actualRatio - expectedRatio) <= tolerance;
};