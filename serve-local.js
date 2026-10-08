const http = require('http');
const fs = require('fs');
const path = require('path');

const files = {
  '/script.js': 'script.js',
  '/classroom-whatsapp-localhost-loader.user.js': 'classroom-whatsapp-localhost-loader.user.js',
  '/classroom-whatsapp-dynamic-loader.user.js': 'classroom-whatsapp-dynamic-loader.user.js',
};

function sendJavaScript(response, content) {
  response.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(content);
}

function buildAutoUpdateLoader() {
  const script = path.join(__dirname, 'script.js');
  const scriptRevision = Math.floor(fs.statSync(script).mtimeMs);
  const revision = Math.max(
    scriptRevision,
    Math.floor(fs.statSync(__filename).mtimeMs),
  );

  return `// ==UserScript==
// @name         Classroom → WhatsApp (local auto-update)
// @namespace    https://lyceum.ztu.edu.ua/
// @version      1.0.${revision}
// @description  Automatically refreshes the local Classroom → WhatsApp script.
// @match        https://classroom.google.com/*
// @match        https://web.whatsapp.com/*
// @match        https://school.mriia.gov.ua/Diary*
// @match        https://school.mriia.gov.ua/SchoolDiaryPresence/*
// @match        https://school.mriia.gov.ua/diaries/subjects/my*
// @grant        GM_setClipboard
// @grant        GM_getClipboard
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @run-at       document-start
// @require      http://127.0.0.1:8765/script.js?revision=${scriptRevision}
// @updateURL    http://127.0.0.1:8765/classroom-whatsapp-autoupdate.user.js
// @downloadURL  http://127.0.0.1:8765/classroom-whatsapp-autoupdate.user.js
// ==/UserScript==
`;
}

http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/classroom-whatsapp-autoupdate.user.js') {
    return sendJavaScript(response, buildAutoUpdateLoader());
  }

  const name = files[pathname];
  if (!name) {
    response.writeHead(404);
    return response.end('Not found');
  }

  fs.readFile(path.join(__dirname, name), (error, content) => {
    if (error) {
      response.writeHead(500);
      return response.end(String(error));
    }
    sendJavaScript(response, content);
  });
}).listen(8765, '127.0.0.1', () => console.log('Local script server: http://127.0.0.1:8765/script.js'));
