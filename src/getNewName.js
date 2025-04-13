const changeCase = require('./changeCase')
const getModelResponse = require('./getModelResponse')
const fs = require('fs').promises
const path = require('path')

/**
 * Get a new name or metadata for a file based on its content
 * @param {Object} options
 * @param {string} options._case - Case style for filename
 * @param {number} options.chars - Max characters for filename
 * @param {string} options.content - File content
 * @param {string} [options.language] - Output language
 * @param {string} [options.videoPrompt] - Video-specific prompt
 * @param {string} [options.pdfPrompt] - PDF-specific prompt
 * @param {string} [options.customPrompt] - Custom instructions
 * @param {string} [options.relativeFilePath] - File path for logging
 * @param {boolean} [options.showPrompt] - Whether to save prompt
 * @param {boolean} [options.useDescription] - Generate description
 * @param {boolean} [options.useKeywords] - Generate keywords
 * @param {boolean} [options.useCategories] - Generate categorized tags
 * @param {Object} [options.categoriesConfig] - Categories configuration
 * @returns {Promise<string>}
 */
module.exports = async options => {
  const { 
    _case, 
    chars, 
    content, 
    language, 
    videoPrompt, 
    pdfPrompt, 
    customPrompt, 
    relativeFilePath, 
    showPrompt, 
    useDescription, 
    useKeywords, 
    useCategories,
    categoriesConfig 
  } = options

  try {
    let promptLines = []
    
    if (useCategories) {
      // Category classification mode
      const topLevelCategories = categoriesConfig?.categories || {};
      if (Object.keys(topLevelCategories).length === 0) {
        throw new Error('Categories mode requires a valid categories configuration object')
      }

      let categoryListText = '';
      for (const parentCat in topLevelCategories) {
        if (topLevelCategories.hasOwnProperty(parentCat)) {
          const parentData = topLevelCategories[parentCat];
          // Optional: Include parent description if desired, for now focusing on children
          // categoryListText += `\n**${parentCat}**: ${parentData.description || 'Parent category'}\n`;
          
          const children = parentData.children || {};
          for (const childCat in children) {
            if (children.hasOwnProperty(childCat)) {
              // Format as: "- ChildCategory: Description"
              categoryListText += `- ${childCat}: ${children[childCat] || 'No description'}\n`;
            }
          }
        }
      }
      // Remove trailing newline
      categoryListText = categoryListText.trim();

      promptLines = [
        `Classify this document into the most relevant specific categories from the list below. Use the provided descriptions for context:`,
        categoryListText, // The generated list of specific categories
        '',
        'Rules:',
        '• Select 1-3 most relevant **specific** categories (e.g., "Invoice", "Contract", not "Financial", "Legal").', // Emphasize selecting leaf nodes
        '• Use ONLY the exact specific category names listed above.',
        '• Separate with commas if multiple.',
        '• Do not invent new categories.',
        '• Order by relevance.',
        '',
        'Example response: "Invoice, Contract, Health"', // Updated example
        '',
        'Respond ONLY with the selected specific categories.'
      ]
    } else if (useKeywords) {
      // Original keyword mode
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
    
    if (useKeywords || useDescription || useCategories) {
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
