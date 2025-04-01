/**
 * processFile.js
 * 
 * This module is responsible for processing individual files for AI-based renaming.
 * It handles different file types (images, videos, and text files) with specialized processing
 * for each type, then uses AI to generate a new name based on the file's content.
 * It also supports generating thumbnails for any file that macOS can render thumbnails for.
 */

// Node.js built-in path module for handling file paths
const path = require('path')
// UUID generator for creating unique temporary directory names
const { v4: uuidv4 } = require('uuid')
// Child process for executing shell commands
const { execSync } = require('child_process')

// Import utility modules
// For determining file types and processing specific file formats
const isImage = require('./isImage')
const isVideo = require('./isVideo')
const saveFile = require('./saveFile')
const getNewName = require('./getNewName')
const extractFrames = require('./extractFrames')
const readFileContent = require('./readFileContent')
const deleteDirectory = require('./deleteDirectory')
const isProcessableFile = require('./isProcessableFile')
const generateThumbnail = require('./generateThumbnail')
const extractAffinityThumbnail = require('./extractAffinityThumbnail')

/**
 * Check if a file is a PDF
 * 
 * @param {string} ext - File extension
 * @returns {boolean} True if the file is a PDF
 */
const isPdf = ({ ext }) => {
  return ext.toLowerCase() === '.pdf'
}

/**
 * Check if a file is an Affinity Designer or Photo file
 * 
 * @param {string} ext - File extension
 * @returns {boolean} True if the file is an Affinity file
 */
const isAffinityFile = ({ ext }) => {
  return ext.toLowerCase() === '.afdesign' || ext.toLowerCase() === '.afphoto'
}

/**
 * Safe string check - ensures a value is a string and has content
 * 
 * @param {any} value - Value to check
 * @returns {boolean} True if the value is a non-empty string
 */
const isNonEmptyString = (value) => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Set Finder comment/description for a file using AppleScript
 * 
 * @param {string} filePath - Path to the file
 * @param {string} description - Description to set as Finder comment
 * @returns {boolean} Success status
 */
const setFinderComment = async ({ filePath, description }) => {
  try {
    // Escape quotes in the description for AppleScript
    const escapedDescription = description.replace(/"/g, '\\"')
    
    // Create and execute the AppleScript command
    const command = `osascript -e 'tell application "Finder" to set comment of (POSIX file "${filePath}" as alias) to "${escapedDescription}"'`
    execSync(command)
    return true
  } catch (error) {
    console.error(`Error setting Finder comment: ${error.message}`)
    return false
  }
}

/**
 * Process a single file for AI-based renaming
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.frames - Number of frames to extract from videos
 * @param {string} options.filePath - Absolute path to the file being processed
 * @param {string} options.inputPath - Root directory being processed
 * @param {boolean} options.useDescription - Whether to set description instead of renaming
 * @returns {Promise<void>}
 */
module.exports = async options => {
  try {
    // Extract necessary options
    const { frames, filePath, inputPath, useDescription } = options

    // Get file information
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const relativeFilePath = path.relative(inputPath, filePath)

    // Skip macOS metadata files
    if (fileName === '.DS_Store') return

    // Check if the file is supported for processing
    if (!isProcessableFile({ filePath })) {
      console.log(`🟡 Unsupported file: ${relativeFilePath}`)
      return
    }

    // Variables to store file content information
    let content               // For text file content
    let videoPrompt           // Additional context for video files
    let pdfPrompt             // Additional context for PDF files
    let images = []           // Collection of image paths for analysis
    let framesOutputDir       // Temporary directory for video frame extraction
    let thumbnailOutputDir    // Temporary directory for generated thumbnails

    // Process file based on its type
    if (isImage({ ext })) {
      // For standard images (jpg, png, etc.), add the file path directly
      // For HEIC, generate a PNG thumbnail first as the model might not support HEIC directly
      if (ext === '.heic') {
        console.log(`📸 Generating PNG thumbnail for HEIC file: ${relativeFilePath}`);
        try {
          const thumbnailPath = await generateThumbnail({ filePath });
          if (thumbnailPath) {
            images.push(thumbnailPath);
            thumbnailOutputDir = path.dirname(thumbnailPath); // Mark for cleanup
            console.log(`🟢 Generated thumbnail for HEIC: ${thumbnailPath}`);
          } else {
            console.log(`🔴 Failed to generate thumbnail for HEIC: ${relativeFilePath}`);
            return; // Skip if thumbnail fails
          }
        } catch (thumbError) {
          console.error(`❌ Error generating thumbnail for HEIC ${relativeFilePath}: ${thumbError.message}`);
          return; // Skip on error
        }
      } else {
        // For other supported image types, assume the model can handle them directly
        images.push(filePath);
      }
    } else if (isVideo({ ext })) {
      // For video files, create a unique temporary directory
      framesOutputDir = `/tmp/ai-renamer/${uuidv4()}`
      
      // Extract representative frames from the video
      const _extractedFrames = await extractFrames({
        frames,               // Number of frames to extract
        framesOutputDir,      // Where to store extracted frames
        inputFile: filePath   // Source video file
      })
      
      // Get the paths to extracted frames and any additional context
      images = _extractedFrames.images
      videoPrompt = _extractedFrames.videoPrompt
    } else if (isPdf({ ext })) {
      // For PDF files, read content and metadata with enhanced PDF processing
      const pdfContent = await readFileContent({ filePath })
      
      if (!pdfContent || (!pdfContent.firstContent && Object.keys(pdfContent.metadata).length === 0)) {
        console.log(`🔴 No PDF content or metadata: ${relativeFilePath}`)
        return
      }
      
      // Create a specific PDF prompt including metadata, with safe string handling
      const metadataStr = Object.entries(pdfContent.metadata)
        .filter(([_, value]) => isNonEmptyString(value))
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
        
      pdfPrompt = `This is a PDF document with ${pdfContent.metadata.pageCount || 'multiple'} pages.\n`
      
      if (metadataStr) {
        pdfPrompt += `PDF Metadata:\n${metadataStr}\n\n`
      }
      
      // Use the first content section of the PDF as the main content
      content = pdfContent.firstContent || pdfContent.fullText
    } else if (isAffinityFile({ ext })) {
      // For Affinity files, extract a thumbnail for analysis
      const _extractedAffinityThumbnail = await extractAffinityThumbnail({ filePath })
      if (_extractedAffinityThumbnail) {
        images.push(_extractedAffinityThumbnail)
      }
    } else {
      // Try to handle any other file type that macOS can generate thumbnails for
      console.log(`🔄 Processing non-standard file type: ${ext} (${relativeFilePath})`);
      try {
        // Generate a thumbnail using qlmanage
        console.log(`📸 Attempting to generate thumbnail using qlmanage for: ${relativeFilePath}`);
        const thumbnailPath = await generateThumbnail({ filePath });
        
        if (thumbnailPath) {
          // If thumbnail generation succeeded, add it to the images array
          images.push(thumbnailPath);
          console.log(`🟢 Generated thumbnail for: ${relativeFilePath}`);
          console.log(`📄 Thumbnail path: ${thumbnailPath}`);
          
          // Mark this path for cleanup
          framesOutputDir = path.dirname(thumbnailPath);
        } else {
          console.log(`⚠️ Thumbnail generation failed, falling back to text content for: ${relativeFilePath}`);
          // Fall back to reading as text if thumbnail generation fails
          content = await readFileContent({ filePath });
          
          // Skip files without readable content
          if (!content) {
            console.log(`🔴 No content or preview: ${relativeFilePath}`);
            return;
          }
        }
      } catch (error) {
        console.error(`❌ Error in thumbnail generation: ${error.message}`);
        // If thumbnail generation fails, fall back to reading as text
        console.log(`⚠️ Falling back to text content for: ${relativeFilePath}`);
        content = await readFileContent({ filePath });
        
        // Skip files without readable content
        if (!content) {
          console.log(`🔴 No text content: ${relativeFilePath}`);
          return;
        }
      }
    }

    // Use AI to generate a new name based on the file content
    const result = await getNewName({ 
      ...options, 
      images,           // Image paths for image/video files
      content,          // Text content for text files
      videoPrompt,      // Additional context for videos
      pdfPrompt,        // Additional context for PDFs
      relativeFilePath  // File location information
    })
    
    // Skip if no result was generated
    if (!result) return

    if (useDescription) {
      // Set the description as a Finder comment instead of renaming the file
      const success = await setFinderComment({ filePath, description: result })
      
      if (success) {
        console.log(`🟢 Set description for: ${relativeFilePath}`)
        console.log(`📝 Description: "${result}"`)
      } else {
        console.log(`🔴 Failed to set description for: ${relativeFilePath}`)
      }
    } else {
      // Rename the file with the AI-generated name
      const newFileName = await saveFile({ ext, newName: result, filePath })
      
      // Calculate the new relative path for reporting
      const relativeNewFilePath = path.join(path.dirname(relativeFilePath), newFileName)
      console.log(`🟢 Renamed: ${relativeFilePath} to ${relativeNewFilePath}`)
    }

    // Clean up temporary files for video processing or thumbnails
    // Clean up temporary directories used for video frames or thumbnails
    const tempDirToClean = framesOutputDir || thumbnailOutputDir;
    if (tempDirToClean) {
      await deleteDirectory({ folderPath: tempDirToClean });
    }
  } catch (err) {
    // Error handling
    console.log(err.message)
  }
}
