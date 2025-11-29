const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'engines', 'w16.html');
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/<script type="module">([\s\S]*?)<\/script>/);

    if (match) {
        const scriptContent = match[1];
        const tempFile = path.join(__dirname, 'engines', 'temp_w16.mjs');
        fs.writeFileSync(tempFile, scriptContent);
        console.log("Extracted script to " + tempFile);
    } else {
        console.log("No script tag found");
    }
} catch (e) {
    console.error("Error: " + e.message);
}
