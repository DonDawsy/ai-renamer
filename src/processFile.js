/**
 * processFile.js
 * 
 * This module is responsible for processing individual files for AI-based renaming.
 * It handles different file types (images, videos, and text files) with specialized processing
 * for each type, then uses AI to generate a new name based on the file's content.
 */

// Node.js built-in path module for handling file paths
const path = require('path')
// UUID generator for creating unique temporary directory names
const { v4: uuidv4 } = require('uuid')

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
 * Safe string check - ensures a value is a string and has content
 * 
 * @param {any} value - Value to check
 * @returns {boolean} True if the value is a non-empty string
 */
const isNonEmptyString = (value) => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Process a single file for AI-based renaming
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.frames - Number of frames to extract from videos
 * @param {string} options.filePath - Absolute path to the file being processed
 * @param {string} options.inputPath - Root directory being processed
 * @returns {Promise<void>}
 */
module.exports = async options => {
  try {
    // Extract necessary options
    const { frames, filePath, inputPath } = options

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

    // Process file based on its type
    if (isImage({ ext })) {
      // For image files, simply add the file path to the images array
      images.push(filePath)
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
      
    } else {
      // For text-based files, read the file content
      content = await readFileContent({ filePath })
      
      // Skip files without readable content
      if (!content) {
        console.log(`🔴 No text content: ${relativeFilePath}`)
        return
      }
    }

    // Use AI to generate a new name based on the file content
    const newName = await getNewName({ 
      ...options, 
      images,           // Image paths for image/video files
      content,          // Text content for text files
      videoPrompt,      // Additional context for videos
      pdfPrompt,        // Additional context for PDFs
      relativeFilePath  // File location information
    })
    
    // Skip if no new name was generated
    if (!newName) return

    // Rename the file with the AI-generated name
    const newFileName = await saveFile({ ext, newName, filePath })
    
    // Calculate the new relative path for reporting
    const relativeNewFilePath = path.join(path.dirname(relativeFilePath), newFileName)
    console.log(`🟢 Renamed: ${relativeFilePath} to ${relativeNewFilePath}`)

    // Clean up temporary files for video processing
    if (isVideo({ ext }) && framesOutputDir) {
      await deleteDirectory({ folderPath: framesOutputDir })
    }
  } catch (err) {
    // Error handling
    console.log(err.message)
  }
}
