const fs = require('fs');
const path = require('path');

// Read existing generated HTML
const renderPath = path.resolve('./new/public/render.html');
const existingHTML = fs.readFileSync(renderPath, 'utf8');

// Extract body content
const bodyMatch = existingHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const bodyContent = bodyMatch ? bodyMatch[1] : existingHTML;

// Extract head scripts/styles
const headMatch = existingHTML.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
const headContent = headMatch ? headMatch[1] : '';

// Create wrapped HTML with guaranteed GSAP and proper structure
const wrappedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1920">
    <title>Reel Render</title>
    
    <!-- Load GSAP from CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    
    <!-- Base styles for proper dimensions -->
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 1080px;
            height: 1920px;
            overflow: hidden;
            background: transparent;
        }
        
        #render-container {
            width: 100%;
            height: 100%;
            position: relative;
        }
    </style>
    
    <!-- Include head content from generated HTML -->
    ${headContent}
</head>
<body>
    <div id="render-container">
        ${bodyContent}
    </div>
    
    <script>
        console.log('%c🎬 Render Page Loaded', 'font-size: 20px; color: #0f0;');
        console.log('GSAP Available:', typeof gsap !== 'undefined');
        console.log('DOM Elements:', document.body.querySelectorAll('*').length);
        
        // Wait for everything to load
        window.addEventListener('load', () => {
            console.log('%c✅ Page Fully Loaded', 'font-size: 16px; color: #0f0;');
            
            setTimeout(() => {
                // Check for GSAP timelines
                if (window.mainTimeline) {
                    console.log('Found mainTimeline, pausing at 0');
                    window.mainTimeline.pause().seek(0);
                }
                
                if (window.tl) {
                    console.log('Found tl, pausing at 0');
                    window.tl.pause().seek(0);
                }
                
                // List all global timeline variables
                const keys = Object.keys(window).filter(k => k.includes('timeline') || k === 'tl');
                console.log('Timeline variables:', keys);
            }, 1000);
        });
        
        // Listen for time updates from Puppeteer
        window.addEventListener('message', (event) => {
            if (event.data.type === 'timeupdate') {
                const time = event.data.time;
                if (window.mainTimeline) {
                    window.mainTimeline.seek(time);
                }
                if (window.tl) {
                    window.tl.seek(time);
                }
            }
        });
    </script>
</body>
</html>`;

// Save wrapped HTML
fs.writeFileSync(renderPath, wrappedHTML);
console.log('✅ Wrapped HTML saved to:', renderPath);
console.log('📏 Size:', wrappedHTML.length, 'bytes');
console.log('\n🌐 Open in browser: http://localhost:3000/render.html');
