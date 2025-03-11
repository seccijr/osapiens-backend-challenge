import express from 'express';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

export const createRootRouter = () => {
    const router = express.Router();
    const staticPath = path.join(__dirname, '../../public');
    
    /**
     * Serves static files from the public directory
     * 
     * @route USE /public
     * 
     * @swagger
     * /public/{filepath}:
     *   get:
     *     summary: Serve static files
     *     description: Serves static files from the public directory
     *     tags: [Static Content]
     *     parameters:
     *       - in: path
     *         name: filepath
     *         required: true
     *         schema:
     *           type: string
     *         description: Path to the static file
     *     responses:
     *       200:
     *         description: Static file served successfully
     *       404:
     *         description: File not found
     */
    router.use('/public', express.static(staticPath));

    /**
     * Renders the README.md file as styled HTML
     * 
     * @route GET /
     * 
     * @swagger
     * /:
     *   get:
     *     summary: Render README
     *     description: Renders the project's README.md file as styled HTML with dark mode
     *     tags: [Documentation]
     *     responses:
     *       200:
     *         description: README successfully rendered as HTML
     *         content:
     *           text/html:
     *             schema:
     *               type: string
     *               description: HTML content of the styled README
     *       500:
     *         description: Error loading README.md file
     */
    router.get('/', (req, res) => {
        const readmePath = path.join(__dirname, '../..', 'README.md');
        fs.readFile(readmePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading README.md:', err);
                return res.status(500).send('Error loading README.md');
            }

            const htmlContent = marked(data);

            // Add CSS for dark mode and image resizing
            const styledHtml = `
      <html>
      <head>
        <style>
          /* General dark mode styles */
          body {
            background-color: #1a1a1a; /* Dark background */
            color: #ffffff; /* Light text */
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            line-height: 1.6;
          }
          a {
            color: #1e90ff; /* Light blue links */
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
          }
          pre {
            background-color: #1e1e1e; /* Darker background for code blocks */
            color: #dcdcdc; /* Light text for code */
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
          code {
            background-color: #1e1e1e;
            color: #dcdcdc;
            padding: 2px 4px;
            border-radius: 3px;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #ffcc00; /* Highlighted headers */
          }
          blockquote {
            color: #cccccc; /* Light gray for quotes */
            border-left: 4px solid #ffcc00;
            padding-left: 10px;
            margin-left: 0;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

            res.setHeader('Content-Type', 'text/html');
            res.send(styledHtml);
        });
    });
    return router;
};