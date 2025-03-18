const path = require('path')
const pdf = require('pdf-parse')
const fs = require('fs').promises

/**
 * Extract and format content from PDF files with metadata
 * 
 * @param {Buffer} dataBuffer - PDF file data buffer
 * @returns {Object} Structured PDF content with text and metadata
 */
const extractPdfContent = async (dataBuffer) => {
  try {
    const pdfData = await pdf(dataBuffer)
    
    // Extract metadata from PDF with proper type checking
    const metadata = {
      title: typeof pdfData.info.Title === 'string' ? pdfData.info.Title : '',
      author: typeof pdfData.info.Author === 'string' ? pdfData.info.Author : '',
      subject: typeof pdfData.info.Subject === 'string' ? pdfData.info.Subject : '',
      keywords: typeof pdfData.info.Keywords === 'string' ? pdfData.info.Keywords : '',
      creator: typeof pdfData.info.Creator === 'string' ? pdfData.info.Creator : '',
      producer: typeof pdfData.info.Producer === 'string' ? pdfData.info.Producer : '',
      pageCount: pdfData.numpages || 0
    }

    // Clean up the text content
    let fullText = pdfData.text.trim()
    
    // Extract the first few paragraphs (likely the most important content)
    let firstContent = fullText.split('\n\n').slice(0, 3).join(' ').trim()
    
    // Limit the content length for processing efficiency
    if (firstContent.length > 500) {
      firstContent = firstContent.substring(0, 500) + '...'
    }

    // Return structured content
    return {
      metadata,
      firstContent,
      fullText: fullText.substring(0, 1000) // Limit full text to 1000 chars
    }
  } catch (err) {
    console.log(`Error extracting PDF content: ${err.message}`)
    return {
      metadata: {},
      firstContent: '',
      fullText: ''
    }
  }
}

module.exports = async ({ filePath }) => {
  try {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.pdf') {
      const dataBuffer = await fs.readFile(filePath)
      const pdfContent = await extractPdfContent(dataBuffer)
      return pdfContent
    } else {
      const content = await fs.readFile(filePath, 'utf8')
      return content
    }
  } catch (err) {
    throw new Error(err.message)
  }
}
