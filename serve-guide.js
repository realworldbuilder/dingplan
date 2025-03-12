// Simple HTTP server script to serve the composer guide
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/composer-guide') {
    fs.readFile(path.join(__dirname, 'composer-guide.html'), (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`
-------------------------------------------
Composer Guide Server
-------------------------------------------
Server running at http://localhost:${PORT}
1. Open the URL in your browser
2. Print the page (Ctrl+P or Cmd+P)
3. Select "Save as PDF" as the destination
4. Click Save to create your PDF
-------------------------------------------
Press Ctrl+C to stop the server
`);
}); 