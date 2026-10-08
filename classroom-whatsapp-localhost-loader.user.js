// ==UserScript==
// @name         Classroom → WhatsApp (localhost)
// @namespace    https://lyceum.ztu.edu.ua/
// @version      5.24-localhost
// @description  Loads Classroom → WhatsApp from the local development server.
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
// @connect       127.0.0.1
// @run-at       document-start
// @require      http://127.0.0.1:8765/script.js
// ==/UserScript==
