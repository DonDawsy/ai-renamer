/**
 * extractAffinityThumbnail.js
 * 
 * This module extracts embedded thumbnails from Affinity Designer (.afdesign) 
 * and Affinity Photo (.afphoto) files.
 * Based on the technique described in https://uechi.io/blog/affinity-thumbnail/
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// PNG signature and IEND chunk signatures based on PNG spec
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // "\x89PNG\r\n\x1A\n"
const IEND_SIG = Buffer.from([73, 69, 78, 68]); // "IEND"

/**
 * Extract the embedded PNG thumbnail from an Affinity file
 * 
 * @param {Object} options - Options for thumbnail extraction
 * @param {string} options.filePath - Path to the Affinity file
 * @returns {Promise<string>} - Path to the extracted thumbnail
 */
module.exports = async ({ filePath }) => {
  try {
    console.log(`🔍 Extracting thumbnail from Affinity file: ${path.basename(filePath)}`);
    
    // Read the file as a buffer
    const buffer = await fs.readFile(filePath);
    
    // Find the PNG signature in the file
    const start = buffer.indexOf(PNG_SIG);
    if (start === -1) {
      console.error('❌ PNG signature not found in the Affinity file');
      return null;
    }
    
    // Find the IEND chunk (end of PNG data)
    const endChunkPos = buffer.indexOf(IEND_SIG, start);
    if (endChunkPos === -1) {
      console.error('❌ IEND chunk not found in the Affinity file');
      return null;
    }
    
    // Extract the PNG blob (including the IEND chunk and its CRC checksum)
    // CRC checksum is 4 bytes long, same as the IEND chunk itself
    const end = endChunkPos + IEND_SIG.length + 4;
    const pngBlob = buffer.subarray(start, end);
    
    // Create a temporary directory to store the thumbnail
    const tempDir = `/tmp/ai-renamer/${uuidv4()}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a filename for the extracted thumbnail
    const thumbnailPath = path.join(tempDir, `${path.basename(filePath)}.png`);
    
    // Write the PNG blob to the file
    await fs.writeFile(thumbnailPath, pngBlob);
    console.log(`🟢 Successfully extracted thumbnail to: ${thumbnailPath}`);
    
    return thumbnailPath;
  } catch (error) {
    console.error(`❌ Error extracting Affinity thumbnail: ${error.message}`);
    return null;
  }
}