/**
 * generateThumbnail.js
 * 
 * This module uses macOS's qlmanage to generate thumbnail previews
 * for files that macOS can render thumbnails for.
 */

const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');
const { exec, spawn } = require('child_process');
const execPromise = promisify(exec);

/**
 * Generate a thumbnail for a file using macOS qlmanage
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.filePath - Path to the file to generate thumbnail for
 * @param {number} options.size - Size of the thumbnail in pixels (default: 1000)
 * @param {number} options.timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<string>} - Path to the generated thumbnail
 */
module.exports = async ({ filePath, size = 1000, timeout = 10000 }) => {
  let tempDir = null;
  let childProcess = null;
  
  try {
    console.log(`🔍 Attempting to generate thumbnail for: ${path.basename(filePath)}`);
    
    // Create a unique temporary directory for this thumbnail
    tempDir = `/tmp/ai-renamer/${uuidv4()}`;
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`📁 Created temporary directory: ${tempDir}`);
    
    // Get the basename of the file
    const fileName = path.basename(filePath);
    
    // Run qlmanage with timeout using spawn instead of exec for better control
    console.log(`🖥️ Executing qlmanage with timeout of ${timeout}ms`);
    
    // Create a promise that will be resolved with the thumbnail path or rejected on timeout
    return new Promise((resolve, reject) => {
      // Set up a timeout to kill the process if it takes too long
      const timeoutId = setTimeout(() => {
        console.log(`⏱️ Thumbnail generation timed out after ${timeout}ms`);
        if (childProcess) {
          childProcess.kill('SIGTERM');
        }
        reject(new Error(`Thumbnail generation timed out after ${timeout}ms`));
      }, timeout);
      
      // Use spawn for better control of the process
      childProcess = spawn('qlmanage', [
        '-t',               // Generate thumbnail
        '-o', tempDir,      // Output directory
        '-s', size.toString(), // Size
        filePath            // Input file
      ]);
      
      let stdoutData = '';
      let stderrData = '';
      
      childProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        console.log(`✓ qlmanage stdout: ${data.toString().trim()}`);
      });
      
      childProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.log(`⚠️ qlmanage stderr: ${data.toString().trim()}`);
      });
      
      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`❌ Failed to start qlmanage: ${error.message}`);
        reject(error);
      });
      
      childProcess.on('close', async (code) => {
        clearTimeout(timeoutId);
        console.log(`qlmanage process exited with code ${code}`);
        
        // Check if the thumbnail was created
        const thumbnailPath = path.join(tempDir, `${fileName}.png`);
        console.log(`🔍 Looking for thumbnail at: ${thumbnailPath}`);
        
        try {
          await fs.access(thumbnailPath);
          const stats = await fs.stat(thumbnailPath);
          
          if (stats.size > 0) {
            console.log(`🟢 Thumbnail created successfully! Size: ${stats.size} bytes`);
            resolve(thumbnailPath);
          } else {
            console.error(`❌ Generated thumbnail has zero size`);
            reject(new Error('Generated thumbnail has zero size'));
          }
        } catch (err) {
          console.error(`❌ Thumbnail not found at path: ${thumbnailPath}`);
          
          // List the contents of the directory to see what was generated
          try {
            const files = await fs.readdir(tempDir);
            console.log(`📋 Contents of ${tempDir}:`);
            for (const file of files) {
              console.log(`   - ${file}`);
              
              // qlmanage might have created the thumbnail with a different name
              // Try to find any PNG files
              if (file.endsWith('.png')) {
                const foundThumbnailPath = path.join(tempDir, file);
                console.log(`🟢 Found alternative thumbnail: ${foundThumbnailPath}`);
                resolve(foundThumbnailPath);
                return;
              }
            }
          } catch (listErr) {
            console.error(`❌ Could not list directory contents: ${listErr.message}`);
          }
          
          reject(new Error(`Failed to generate thumbnail for ${filePath}`));
        }
      });
    });
  } catch (error) {
    console.error(`❌ Error generating thumbnail: ${error.message}`);
    if (tempDir) {
      // Try to clean up the directory even if there was an error
      try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
        }
        await fs.rmdir(tempDir);
        console.log(`🧹 Cleaned up temporary directory ${tempDir}`);
      } catch (cleanupError) {
        console.error(`❌ Error cleaning up: ${cleanupError.message}`);
      }
    }
    return null;
  }
}