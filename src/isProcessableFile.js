/**
 * isProcessableFile.js
 * 
 * This module determines if a file can be processed by the application.
 * It now returns true for all files since we support any file type that
 * macOS can generate thumbnails for using qlmanage.
 */

const path = require('path')

// Import supported extensions for compatibility with existing code
const supportedExtensions = require('./supportedExtensions')

module.exports = ({ filePath }) => {
  // Skip hidden files that start with a dot
  const fileName = path.basename(filePath)
  if (fileName.startsWith('.')) {
    return false
  }
  
  // Skip macOS metadata files
  if (fileName === '.DS_Store') {
    return false
  }
  
  // Process all other files - we'll attempt thumbnail generation for unsupported types
  return true
}
