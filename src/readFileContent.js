const path = require('path')
const pdf = require('pdf-parse')
const fs = require('fs').promises
const mammoth = require('mammoth')
const { promisify } = require('util')

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

/**
 * Extract text from a .doc file using textract
 * 
 * @param {string} filePath - Path to the .doc file
 * @returns {Promise<string>} Extracted text content
 */
const extractWithTextract = async (filePath) => {
  try {
    const textract = require('textract')
    const extractText = promisify(textract.fromFileWithPath)
    return await extractText(filePath)
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('For better support of .doc files, install textract: npm install textract')
      return null
    }
    throw err
  }
}

/**
 * Extract text from a Word document (.doc or .docx)
 * Limits content to approximately first page (2000 characters)
 * 
 * @param {string} filePath - Path to the document
 * @returns {Promise<string>} Extracted text content
 */
const extractWordContent = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  let text = null

  // Try mammoth first (better for .docx)
  try {
    const result = await mammoth.extractRawText({ path: filePath })
    text = result.value
  } catch (mammothError) {
    console.log(`Mammoth couldn't process ${filePath}, trying alternative method...`)
  }

  // If mammoth failed and it's a .doc file, try textract
  if (!text && ext === '.doc') {
    text = await extractWithTextract(filePath)
  }

  if (!text) return ''

  // Clean up the text and limit to approximately first page
  text = text.trim()
  
  // Get first few paragraphs (likely the most important content)
  const paragraphs = text.split('\n\n')
  const firstPageContent = paragraphs.slice(0, 3).join('\n\n').trim()

  // Limit to ~2000 chars which is roughly one page
  if (firstPageContent.length > 2000) {
    return firstPageContent.substring(0, 2000) + '...'
  }
  
  return firstPageContent
}

module.exports = async ({ filePath }) => {
  try {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.pdf') {
      const dataBuffer = await fs.readFile(filePath)
      const pdfContent = await extractPdfContent(dataBuffer)
      return pdfContent
    } else if (ext === '.doc' || ext === '.docx') {
      const content = await extractWordContent(filePath)
      return content
    } else {
      const content = await fs.readFile(filePath, 'utf8')
      return content
    }
  } catch (err) {
    throw new Error(err.message)
  }
}
