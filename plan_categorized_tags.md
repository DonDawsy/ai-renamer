# Categorized Tagging System Implementation Plan

## Overview
Implement a system to classify documents into predefined categories rather than generating free-form tags.

## Core Components

### 1. Category Taxonomy
```json
{
  "categories": [
    "Financial/Invoice",
    "Financial/Receipt",
    "Financial/Tax",
    "Legal/Contract", 
    "Legal/Agreement",
    "Personal/Identification",
    "Personal/Health",
    "Travel/Flight",
    "Travel/Hotel",
    "Work/Project",
    "Work/Meeting",
    "Education/Certificate",
    "Education/Transcript"
  ],
  "strictMode": true,
  "allowCustomTags": false
}
```

### 2. Modified Prompt Structure
```
Classify this document into the most relevant categories from this exact list:
{{categories}}

Rules:
• Select 1-3 most relevant categories  
• Use ONLY the exact category names above
• Separate with commas if multiple
• Do not invent new categories
• Order by relevance

Example response: "Financial/Invoice, Work/Project"

Document content:
{{content}}
```

### 3. Implementation Steps

1. Create `config/categories.json` with above structure
2. Modify `getNewName.js` to use new prompt
3. Update `setFinderTags` in `processFile.js` to:
   - Load categories from config
   - Validate against allowed categories
   - Maintain existing validation for non-category tags
4. Add error handling for invalid categories
5. Document the new system in README.md

## Next Steps
1. Review this plan
2. Switch to Code mode to implement changes