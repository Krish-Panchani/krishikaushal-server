// Existing imports
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const util = require('util');
const mime = require('mime-types');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer to save the file with its original extension
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + Date.now() + ext);
    }
});

const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const initialPrompt = `Analyze Image give crop or plant name, what diseases it has, and what to do to cure it. this response will be send to farmers so explanation should be in easy language. \n\n
response should be in JSON format. \n\n
{
  "crop": "crop name",
  "disease": "disease name",
  "treatment": "treatment name"
}`;

// Existing endpoint for image analysis
app.post('/api/analyzeImage', upload.single('image'), async (req, res) => {
    try {
        const imagePath = req.file ? req.file.path : null;

        if (!imagePath) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const imageData = fs.readFileSync(imagePath);
        const imageBase64 = imageData.toString('base64');

        // Determine MIME type dynamically
        const mimeType = mime.lookup(imagePath) || 'application/octet-stream';

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: mimeType
            }
        };

        const safetySettings = [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            safetySettings
        });

        const result = await model.generateContent([initialPrompt, imagePart]);

        const response = await result.response;
        const text = await response.text();

        res.json({ text });
        
    } catch (error) {
        console.error('Error during image analysis:', error.message, error.stack);
        res.status(500).json({ error: 'Image analysis failed' });
    }
});


app.post('/api/voiceSearch', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'No query provided' });
        }

        const searchPrompt = `Provide information or answers related to the following query: "${query}". Return relevant details and information. only give response if query is agriculture related otherwise return response "Your Query is not Agriculture related". Response should be in json format. \n\n
        {
        query: "${query}",
        response: "response"
        }`;

        const safetySettings = [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            safetySettings
        });

        const result = await model.generateContent([searchPrompt]);

        const response = await result.response;
        const text = await response.text();

        res.json({ text });
        
    } catch (error) {
        console.error('Error during text search:', error.message, error.stack);
        res.status(500).json({ error: 'Text search failed' });
    }
});

app.post('/api/predictCrop', async (req, res) => {
    try {
        const { soilType, climate, previousYield } = req.body;

        if (!soilType || !climate || !previousYield) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // A prompt to generate a prediction
        const cropPredictionPrompt = `Based on the following farm-specific data, recommend the best crops to maximize yield:\n
        Soil Type: ${soilType}\n
        Climate Conditions: ${climate}\n
        Previous Crop Yield: ${previousYield}\n
        Provide a list of the best-suited crops. Response should only be in JSON format.\n\n
        {
            "crops": ["crop1", "crop2", "crop3"]
        }`;

        const safetySettings = [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            safetySettings
        });

        const result = await model.generateContent([cropPredictionPrompt]);

        const response = await result.response;
        let text = await response.text();

        // Log the entire response text for debugging
        console.log('Raw Response Text:', text);

        // Step 2: Sanitize the Response
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Log the sanitized response
        console.log('Sanitized Response Text:', text);

        // Step 3: Parse the Cleaned JSON Text
        const jsonResponse = JSON.parse(text);

        res.json(jsonResponse);
    } catch (error) {
        console.error('Error during crop prediction:', error.message, error.stack);
        res.status(500).json({ error: 'Crop prediction failed' });
    }
});




const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
