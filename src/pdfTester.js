/**
 * pdfTester.js
 * 
 * A utility script to test PDF processing functionality by processing
 * all PDF files in the PDFTest directory.
 * 
 * Usage: node pdfTester.js
 */

const fs = require('fs');
const path = require('path');
const chooseModel = require('./chooseModel');
const processFile = require('./processFile');

// Default configuration options
const defaultOptions = {
  frames: 3,             // Default frame count (not used for PDFs but required by processFile)
  provider: 'ollama',    // Default provider
  baseURL: 'http://127.0.0.1:11434', // Default Ollama URL
  _case: 'capitalCase',    // Default case style
  chars: 35,             // Default max character length
  language: 'English',   // Default language
  showPrompt: true       // Enable prompt display by default
};

// Check if Ollama is running
async function checkOllamaStatus() {
  try {
    const axios = require('axios');
    await axios.get(`${defaultOptions.baseURL}/api/version`);
    return true;
  } catch (err) {
    return false;
  }
}

// Main function to process PDF files
async function testPdfProcessing() {
  try {
    console.log('🔧 PDF Renaming Tester');
    console.log('====================\n');

    // Set up paths
    const projectRoot = path.resolve(__dirname, '..');
    const testDirPath = path.join(projectRoot, 'PDFTest');
    
    console.log(`🔍 Looking for PDF files in: ${testDirPath}`);
    
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDirPath)) {
      console.log(`📁 Creating test directory: ${testDirPath}`);
      fs.mkdirSync(testDirPath, { recursive: true });
      console.log(`⚠️ No PDF files found. Please add PDF files to ${testDirPath} and run again.`);
      return;
    }
    
    // Get all files in the test directory
    const files = fs.readdirSync(testDirPath);
    const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
    
    if (pdfFiles.length === 0) {
      console.log(`⚠️ No PDF files found in ${testDirPath}. Please add some PDF files and run again.`);
      return;
    }
    
    console.log(`📊 Found ${pdfFiles.length} PDF file(s) to process:`);
    pdfFiles.forEach(file => console.log(`   - ${file}`));
    
    // Check if Ollama is running
    const ollamaRunning = await checkOllamaStatus();
    if (!ollamaRunning) {
      console.log('\n⚠️ Warning: Ollama server does not appear to be running.');
      console.log('AI renaming requires a running Ollama server at http://127.0.0.1:11434');
      console.log('Please start Ollama before continuing.\n');
      
      // Ask for confirmation to proceed anyway
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const response = await new Promise(resolve => {
        readline.question('Do you want to try to proceed anyway? (y/n): ', resolve);
      });
      
      readline.close();
      
      if (response.toLowerCase() !== 'y') {
        console.log('Operation cancelled.');
        return;
      }
    }
    
    // Get available models - attempt to select a model but don't fail if unsuccessful
    let model;
    try {
      model = await chooseModel({ 
        provider: defaultOptions.provider,
        baseURL: defaultOptions.baseURL
      });
      console.log(`🤖 Using model: ${model}`);
    } catch (error) {
      console.log(`⚠️ Could not auto-select model: ${error.message}`);
      console.log('🔄 Proceeding with default model "llama3"');
      model = 'llama3';
    }
    
    // Process each PDF file
    const options = {
      ...defaultOptions,
      model,
      inputPath: testDirPath
    };
    
    console.log('\n🚀 Starting processing...\n');
    
    // Process each PDF file sequentially
    for (const file of pdfFiles) {
      const filePath = path.join(testDirPath, file);
      console.log(`🔄 Processing: ${file}`);
      await processFile({
        ...options,
        filePath
      });
      console.log('-----------------------------------');
    }
    
    console.log('\n✅ PDF testing complete!');
  } catch (error) {
    console.error(`❌ Error in PDF testing: ${error.message}`);
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('\nThis error might be due to missing dependencies.');
      console.error('Try running: npm install');
    }
  }
}

// Run the tester function if this script is run directly
if (require.main === module) {
  testPdfProcessing();
}

module.exports = testPdfProcessing;
