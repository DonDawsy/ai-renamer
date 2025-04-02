const changeCase = require('./changeCase')
const getModelResponse = require('./getModelResponse')
const fs = require('fs').promises
const path = require('path')

module.exports = async options => {
  const { _case, chars, content, language, videoPrompt, pdfPrompt, customPrompt, relativeFilePath, showPrompt, useDescription, useKeywords } = options

  try {
    let promptLines = []
    
    if (useKeywords) {
      // Prompt for keywords mode
      promptLines = [
        'Generate keywords for this file:',
        '',
        'Rules:',
        '• Maximum 10 keywords, can be less',
        '• Use only relevant keywords',
        '• Avoid using colors',
        `• Use ONLY English words, translate if necessary`,
        '• Include important subjects, actions, and visual elements',
        '• Separate keywords with commas',
        '• Use single words',
        '• Order by relevance',
        '',
        'Respond ONLY with the comma-separated keywords.'
      ]
    } else if (useDescription) {
      // Prompt for description mode
      promptLines = [
        'Generate a detailed description of this file for use as metadata:',
        '',
        'Rules:',
        '• Provide a comprehensive yet concise description',
        `• Use ${language} language`,
        '• Describe visual elements, content, and context',
        '• Format in complete sentences',
        '• Maximum 2-3 sentences',
        '• Include key details that would help identify this file',
        '',
        'Respond ONLY with the description.'
      ]
    } else {
      // Original prompt for filename mode
      promptLines = [
        'Generate descriptive filename for the provided image:',
        '',
        'Rules:',
        `• Max ${chars} characters`,
        '• English words only',
        '• Exclude file extension',
        '• No special characters',
        '• Include only essential elements',
        '• Format: Noun + Action/State',
        '• Describe main subject and activity',
        '',
        'Example: "Cat Sleeping" for an image of a sleeping cat',
        '',
        'Respond ONLY with the generated filename.'
      ]
    }

    if (videoPrompt) {
      promptLines.unshift(videoPrompt, '')
    }
    
    // Add PDF-specific prompt guidance if available
    if (pdfPrompt) {
      promptLines.unshift(pdfPrompt, '')
      
      // Add specific instructions for PDF naming only in filename mode
      if (!useDescription) {
        promptLines.splice(promptLines.length - 1, 0, 
          'For PDF files:',
          '- Prioritize document title if available',
          '- Include main topic/subject',
          '- Add year or date if present with a space before: "filename YYYY" (not "filenameYYYY")',
          '- Format as "topic-purpose" if possible',
        )
      }
    }

    if (content) {
      promptLines.push('', 'Content:', content)
    }

    if (customPrompt) {
      promptLines.push('', 'Custom instructions:', customPrompt)
    }

    const prompt = promptLines.join('\n')

    // Save the prompt to a file if showPrompt is enabled
    if (showPrompt) {
      try {
        // Get the project root directory
        const projectRoot = path.resolve(__dirname, '..')
        const promptFilePath = path.join(projectRoot, 'prompt.md')
        
        // Create markdown content with file information
        const fileInfo = relativeFilePath ? `\n\n## Processing file: ${relativeFilePath}` : ''
        const timestamp = new Date().toISOString()
        const markdownContent = `# AI-Renamer Prompt - ${timestamp}${fileInfo}\n\n\`\`\`\n${prompt}\n\`\`\`\n`
        
        // Write to the prompt.md file
        await fs.writeFile(promptFilePath, markdownContent)
        console.log(`📄 Prompt saved to: prompt.md`)
      } catch (err) {
        console.log(`⚠️ Could not save prompt to file: ${err.message}`)
      }
    }

    const modelResult = await getModelResponse({ ...options, prompt })
    
    if (useKeywords || useDescription) {
      // For keywords and description modes, return the full text without character limit or case conversion
      return modelResult.trim()
    } else {
      // For filename mode, process as before
      const maxChars = chars + 10
      const text = modelResult.trim().slice(-maxChars)
      
      const filename = await changeCase({ text, _case })
      
      // Post-process to fix year spacing
      const fixedFileName = filename.replace(/([a-zA-Z])(\d{4})$/, '$1 $2')
      return fixedFileName
    }
  } catch (err) {
    console.log(`🔴 Model error: ${err.message} (${relativeFilePath})`)
  }
}
