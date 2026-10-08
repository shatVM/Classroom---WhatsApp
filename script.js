// ==UserScript==
// @name         Classroom → WhatsApp
// @namespace    https://lyceum.ztu.edu.ua/
// @version      5.24
// @description  Вибір учнів у Google Classroom та підготовка повідомлення у WhatsApp
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
// ==/UserScript==

(function () {

    'use strict';


    // ============================================================
    // НАЛАШТУВАННЯ
    // ============================================================

    const APP_NAME = 'Classroom → WhatsApp';

    const SCRIPT_VERSION = '5.24';

    const SCRIPT_BUILD_TIMESTAMP = '7.10.26 18:07';

    const WHATSAPP_CHAT_NAME = 'Відвідування';

    const WHATSAPP_URL =
        'https://web.whatsapp.com/';

    const WHATSAPP_WINDOW_NAME =
        'classroom-whatsapp';

    const WHATSAPP_START_DELAY = 3000;

    const PAYLOAD_KEY =
        'classroom_whatsapp_payload';

    // Сигнал для WhatsApp
    const TRANSFER_KEY =
        'classroom_whatsapp_transfer';

    const WHATSAPP_HEARTBEAT_KEY =
        'classroom_whatsapp_heartbeat';

    const WHATSAPP_HEARTBEAT_INTERVAL =
        5000;

    const WHATSAPP_HEARTBEAT_MAX_AGE =
        20000;

    let lastWhatsAppHeartbeat =
        0;

    const DEBUG = true;

    const pageWindow =
        typeof unsafeWindow !== 'undefined'
            ? unsafeWindow
            : window;


    // ============================================================
    // LOG
    // ============================================================

    function log(...args) {

        if (DEBUG) {

            console.log(
                `[${APP_NAME}]`,
                ...args
            );

        }

    }


    // ============================================================
    // SLEEP
    // ============================================================

    function sleep(ms) {

        return new Promise(
            resolve => setTimeout(resolve, ms)
        );

    }


    // ============================================================
    // ВІДКРИТТЯ WHATSAPP
    // ============================================================

    function openWhatsApp() {


        // Викликаємо синхронно в обробнику натискання кнопки,
        // щоб браузер не заблокував відкриття вкладки як popup.
        const whatsappWindow =
            window.open(
                WHATSAPP_URL,
                WHATSAPP_WINDOW_NAME
            );


        if (whatsappWindow) {

            log(
                'Вкладку WhatsApp відкрито або повторно використано'
            );

        } else {

            log(
                'Браузер заблокував відкриття WhatsApp'
            );

        }

    }


    function ensureWhatsAppIsOpen() {


        const heartbeatAge =
            Date.now() -
            lastWhatsAppHeartbeat;


        if (
            lastWhatsAppHeartbeat &&
            heartbeatAge <
            WHATSAPP_HEARTBEAT_MAX_AGE
        ) {

            log(
                'WhatsApp уже відкритий — передаємо дані в наявну вкладку'
            );


            return;

        }


        log(
            'Відкритої вкладки WhatsApp немає — відкриваємо нову'
        );


        openWhatsApp();

    }


    async function startClassroomWhatsAppMonitor() {


        try {


            lastWhatsAppHeartbeat =
                await GM_getValue(
                    WHATSAPP_HEARTBEAT_KEY,
                    0
                );


            GM_addValueChangeListener(

                WHATSAPP_HEARTBEAT_KEY,

                function (
                    name,
                    oldValue,
                    newValue
                ) {


                    lastWhatsAppHeartbeat =
                        Number(newValue) ||
                        0;

                }

            );


        } catch (error) {


            log(
                'Не вдалося перевірити вкладку WhatsApp:',
                error
            );

        }

    }


    // ============================================================
    // ФОРМАТУВАННЯ ІМЕНІ
    // ============================================================

    function formatName(name) {

        if (!name) {

            return '';

        }


        const parts =
            name
                .trim()
                .split(/\s+/);


        if (parts.length < 2) {

            return name.trim();

        }


        const firstName =
            parts[0];


        const lastName =
            parts.slice(1).join(' ');


        return `${lastName} ${firstName}`;

    }


    // ============================================================
    // НАЗВА КЛАСУ
    // ============================================================

    function getClassroomHeader() {

        const selectors = [

            '#rta25k .Vu2fZd.r9JCQd.gycFA',

            '[id="rta25k"] .Vu2fZd.r9JCQd.gycFA',

            '.Vu2fZd.r9JCQd.gycFA',

            '[data-purpose="course-name"]'

        ];


        for (
            const selector of selectors
        ) {

            try {

                const element =
                    document.querySelector(
                        selector
                    );


                if (element) {

                    const text =
                        element.textContent
                            .replace(/\s+/g, ' ')
                            .trim();


                    if (text) {

                        log(
                            'Назву класу знайдено:',
                            text
                        );


                        return text;

                    }

                }

            } catch (error) {

                log(
                    'Помилка пошуку класу:',
                    error
                );

            }

        }


        // --------------------------------------------------------
        // Резервний пошук
        // --------------------------------------------------------

        const elements =
            document.querySelectorAll(
                '.Vu2fZd, [class*="Vu2fZd"]'
            );


        for (
            const element of elements
        ) {

            const text =
                element.textContent
                    .replace(/\s+/g, ' ')
                    .trim();


            if (!text) {

                continue;

            }


            if (

                /\b10-[А-ЯA-ZІЇЄҐ]\b/i.test(text) ||

                /\b11-[А-ЯA-ZІЇЄҐ]\b/i.test(text)

            ) {

                log(
                    'Клас знайдено резервним пошуком:',
                    text
                );


                return text;

            }

        }


        log(
            'Назву класу не знайдено'
        );


        return '';

    }


    // ============================================================
    // ВИБРАНІ УЧНІ
    // ============================================================

    function getSelectedStudents() {

        const checkboxes =
            document.querySelectorAll(
                'input[type="checkbox"][aria-label]'
            );


        const students = [];


        checkboxes.forEach(
            checkbox => {


                if (!checkbox.checked) {

                    return;

                }


                const name =
                    checkbox.getAttribute(
                        'aria-label'
                    );


                if (!name) {

                    return;

                }


                const formatted =
                    formatName(name);


                if (formatted) {

                    students.push(
                        formatted
                    );

                }

            }
        );


        log(
            'Вибрані учні:',
            students
        );


        return students;

    }


    // ============================================================
    // ФОРМУВАННЯ ПОВІДОМЛЕННЯ
    // ============================================================

    function buildResult(status) {

        const className =
            getClassroomHeader();


        const students =
            getSelectedStudents();


        const lines = [];


        // --------------------------------------------------------
        // КЛАС + СТАТУС В ОДНОМУ РЯДКУ
        // --------------------------------------------------------

        if (!students.length) {

            lines.push(
                `${className || 'Клас'} присутні всі`
            );

        } else if (className) {

            lines.push(
                `${className} ${status}`
            );

        } else {

            lines.push(
                status
            );

        }


        // --------------------------------------------------------
        // УЧНІ
        // --------------------------------------------------------

        students.forEach(
            student => {

                lines.push(
                    student
                );

            }
        );


        const text =
            lines.join('\n');


        log(
            'Сформований текст:'
        );


        console.log(text);


        return {

            text: text,

            count:
                students.length,

            className:
                className,

            status:
                status,

            students:
                students,

            timestamp:
                Date.now()

        };

    }


    // ============================================================
    // КОПІЮВАННЯ В БУФЕР
    // ============================================================

    async function copyToClipboard(text) {


        // --------------------------------------------------------
        // GM_setClipboard
        // --------------------------------------------------------

        try {

            if (
                typeof GM_setClipboard ===
                'function'
            ) {

                GM_setClipboard(
                    text,
                    'text'
                );


                log(
                    'GM_setClipboard: OK'
                );


                return true;

            }

        } catch (error) {

            log(
                'GM_setClipboard:',
                error
            );

        }


        // --------------------------------------------------------
        // navigator.clipboard
        // --------------------------------------------------------

        try {

            await navigator.clipboard.writeText(
                text
            );


            log(
                'navigator.clipboard: OK'
            );


            return true;

        } catch (error) {

            log(
                'navigator.clipboard:',
                error
            );

        }


        // --------------------------------------------------------
        // textarea
        // --------------------------------------------------------

        try {

            const textarea =
                document.createElement(
                    'textarea'
                );


            textarea.value =
                text;


            textarea.style.position =
                'fixed';


            textarea.style.left =
                '-9999px';


            document.body.appendChild(
                textarea
            );


            textarea.focus();

            textarea.select();


            const result =
                document.execCommand(
                    'copy'
                );


            textarea.remove();


            return result;

        } catch (error) {

            log(
                'textarea:',
                error
            );


            return false;

        }

    }


    // ============================================================
    // ВІДПРАВЛЕННЯ ДАНИХ У WHATSAPP
    // ============================================================

    async function startWhatsAppTransfer(
        status,
        dataBuilder = buildResult
    ) {

        log(
            `Підготовка: ${status}`
        );


        // Перевіряємо heartbeat WhatsApp до першої async-операції.
        // Якщо вкладка вже відкрита, вона отримає дані без дублювання.
        ensureWhatsAppIsOpen();


        // --------------------------------------------------------
        // Формуємо текст
        // --------------------------------------------------------

        const data =
            dataBuilder(status);


        // --------------------------------------------------------
        // Копіюємо
        // --------------------------------------------------------

        const copied =
            await copyToClipboard(
                data.text
            );


        if (!copied) {

            log('Не вдалося скопіювати текст.');

            return false;

        }


        // --------------------------------------------------------
        // Зберігаємо payload
        // --------------------------------------------------------

        await GM_setValue(
            PAYLOAD_KEY,
            data
        );


        log(
            'Payload збережено'
        );


        // ========================================================
        // ГОЛОВНА ЗМІНА v5.9
        //
        // Створюємо НОВИЙ timestamp.
        //
        // WhatsApp, який уже відкритий,
        // отримає цю зміну.
        // ========================================================

        const transfer = {

            timestamp:
                Date.now(),

            status:
                status,

            text:
                data.text

        };


        await GM_setValue(
            TRANSFER_KEY,
            transfer
        );


        log(
            'Сигнал WhatsApp відправлено:',
            transfer
        );


        // --------------------------------------------------------
        // ВАЖЛИВО:
        //
        // НОВУ ВКЛАДКУ НЕ ВІДКРИВАЄМО.
        //
        // Якщо WhatsApp вже відкритий,
        // він сам отримає сигнал.
        // --------------------------------------------------------


        log(
            'Дані передані. WhatsApp відкривається автоматично.'
        );


        return true;

    }


    // ============================================================
    // СТВОРЕННЯ КНОПКИ
    // ============================================================

    function createButton({

        id,

        text,

        bottom,

        title,

        background

    }) {


        if (
            document.getElementById(id)
        ) {

            return document.getElementById(id);

        }


        const button =
            document.createElement(
                'button'
            );


        button.id =
            id;


        button.textContent =
            text;


        button.title =
            title;


        Object.assign(
            button.style,
            {

                position:
                    'fixed',

                right:
                    '20px',

                bottom:
                    `${bottom}px`,

                width:
                    '52px',

                height:
                    '52px',

                borderRadius:
                    '50%',

                border:
                    'none',

                cursor:
                    'pointer',

                zIndex:
                    '2147483647',

                fontSize:
                    '25px',

                display:
                    'flex',

                alignItems:
                    'center',

                justifyContent:
                    'center',

                opacity:
                    '0.6',

                background:
                    background,

                boxShadow:
                    '0 2px 8px rgba(0,0,0,.3)',

                transition:
                    'opacity .2s, transform .2s'

            }
        );


        button.addEventListener(
            'mouseenter',
            () => {

                button.style.opacity =
                    '1';


                button.style.transform =
                    'scale(1.05)';

            }
        );


        button.addEventListener(
            'mouseleave',
            () => {

                button.style.opacity =
                    '0.6';


                button.style.transform =
                    'scale(1)';

            }
        );


        document.body.appendChild(
            button
        );


        return button;

    }


    // ============================================================
    // КНОПКИ CLASSROOM
    // ============================================================

    function initClassroomButtons() {


        if (!document.body) {

            return;

        }


        // ========================================================
        // 🔴 ВІДСУТНІ
        // ========================================================

        const absentButton =
            createButton({

                id:
                    'classroom-absent-button',

                text:
                    '🔴',

                bottom:
                    20,

                title:
                    'Відсутні — передати у WhatsApp',

                background:
                    '#ffcdd2'

            });


        absentButton.onclick =
            async function () {


                absentButton.style.transform =
                    'scale(0.9)';


                setTimeout(
                    () => {

                        absentButton.style.transform =
                            'scale(1)';

                    },
                    150
                );


                await startWhatsAppTransfer(
                    'відсутні'
                );

            };


        // ========================================================
        // 🟢 ПРИСУТНІ
        // ========================================================

        const presentButton =
            createButton({

                id:
                    'classroom-present-button',

                text:
                    '🟢',

                bottom:
                    82,

                title:
                    'Присутні — передати у WhatsApp',

                background:
                    '#c8e6c9'

            });


        presentButton.onclick =
            async function () {


                presentButton.style.transform =
                    'scale(0.9)';


                setTimeout(
                    () => {

                        presentButton.style.transform =
                            'scale(1)';

                    },
                    150
                );


                await startWhatsAppTransfer(
                    'присутні'
                );

            };

    }


    // ============================================================
    // КНОПКИ ЖУРНАЛУ МРІЇ
    // ============================================================

    const selectedMriiaStudents = new Map();

    let mriiaPanelPreview = '';

    let mriiaPanelNotice = '';

    function renderMriiaPanel() {

        const panel =
            document.getElementById('mriia-student-panel-content');

        if (!panel) {

            return;

        }

        const nextText =
            mriiaPanelPreview ||
            mriiaPanelNotice ||
            (selectedMriiaStudents.size
                ? [...selectedMriiaStudents.values()].join('\n')
                : 'Натисніть на ім’я учня');

        if (panel.textContent !== nextText) {

            panel.textContent = nextText;

        }

        const isPreview = Boolean(mriiaPanelPreview);

        if (panel.classList.contains('mriia-message-preview') !== isPreview) {

            panel.classList.toggle('mriia-message-preview', isPreview);

        }

    }


    function clearMriiaSelection() {

        selectedMriiaStudents.clear();

        document
            .querySelectorAll('.mriia-selected-student')
            .forEach(cell => cell.classList.remove('mriia-selected-student'));

        renderMriiaPanel();

    }


    function updateMriiaDateButtonState(button) {

        const isBusy =
            button.dataset.importing === 'true';

        const nextText = isBusy ? '…' : '↓';

        if (button.textContent !== nextText) {

            button.textContent = nextText;

        }

        if (button.getAttribute('aria-pressed') !== String(isBusy)) {

            button.setAttribute('aria-pressed', String(isBusy));

        }

        if (button.classList.contains('is-selected') !== isBusy) {

            button.classList.toggle('is-selected', isBusy);

        }

    }


    function normalizeMriiaName(name) {

        return name
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase('uk-UA');

    }


    function readClipboardText() {

        if (typeof GM_getClipboard === 'function') {

            return new Promise((resolve, reject) => {

                let settled = false;

                const finish = (callback, value) => {

                    if (settled) {

                        return;

                    }

                    settled = true;
                    clearTimeout(timeout);
                    callback(value);

                };

                const timeout = setTimeout(() => {

                    finish(reject, new Error('Clipboard read timed out'));

                }, 1500);

                try {

                    const result = GM_getClipboard(
                        text => finish(resolve, String(text || '')),
                        'text'
                    );

                    if (typeof result === 'string') {

                        finish(resolve, result);

                    } else if (result && typeof result.then === 'function') {

                        result.then(
                            text => finish(resolve, String(text || '')),
                            error => finish(reject, error)
                        );

                    }

                } catch (error) {

                    finish(reject, error);

                }

            }).catch(() => navigator.clipboard.readText());

        }

        return navigator.clipboard.readText();

    }


    function parseClipboardGrades(source) {

        const data =
            typeof source === 'string'
                ? JSON.parse(source.replace(/^\uFEFF/, '').trim())
                : source;

        if (!data || typeof data !== 'object' || Array.isArray(data)) {

            throw new Error('Очікується JSON-об’єкт з учнями та оцінками.');

        }

        const entries =
            Object.entries(data)
                .filter(([name]) => name !== 'Середня оцінка курсу');

        return {
            grades: entries
                .filter(([, grades]) => Array.isArray(grades) && grades.length === 1)
                .map(([name, grades]) => ({
                    normalizedName: normalizeMriiaName(name),
                    value: String(grades[0]).trim(),
                }))
                .filter(item => item.value),
            unsupported: entries.filter(([, grades]) =>
                !Array.isArray(grades) || grades.length > 1
            ).length,
        };

    }


    function showMriiaPanelNotice(message) {

        mriiaPanelNotice = message;
        renderMriiaPanel();

    }


    async function importClipboardGradesForColumn(
        header,
        button,
        date,
        suppliedGrades = null
    ) {

        if (button.dataset.importing === 'true') {

            return;

        }

        button.dataset.importing = 'true';
        updateMriiaDateButtonState(button);
        showMriiaPanelNotice(
            `${suppliedGrades ? 'Готую оцінки' : 'Читаю оцінки з буфера'} для ${date}…`
        );

        try {

            const rawText = suppliedGrades ? null : await readClipboardText();
            const parsedClipboard = suppliedGrades
                ? { grades: suppliedGrades, unsupported: 0 }
                : parseClipboardGrades(rawText);
            const grades = parsedClipboard.grades;

            if (!grades.length) {

                throw new Error('У буфері немає учнів з однією оцінкою.');

            }

            const table = header.closest('.table-schedule');
            const headerIndex =
                [...header.parentElement.children].indexOf(header);
            const scoreHeader =
                table?.querySelectorAll('tr')[1]?.children[headerIndex + 1];
            const targetGroupId = scoreHeader?.getAttribute('data-group');

            if (!table || !targetGroupId) {

                throw new Error('Не вдалося визначити колонку оцінок.');

            }

            const scoreHeaderRow = table.querySelectorAll('tr')[1];
            const scopeAttributes = [
                'data-subject-id',
                'data-subgroup-name',
                'data-educational-plan-id',
                'data-class-name',
            ];

            const rowsByName = new Map();

            table.querySelectorAll('tr').forEach(row => {

                const nameElement =
                    row.querySelector('.pupil .table-user');

                if (!nameElement) {

                    return;

                }

                const fullName =
                    nameElement.dataset.mriiaFullName ||
                    nameElement.textContent.trim();

                const nameParts = fullName.split(/\s+/).filter(Boolean);
                const firstTwo = nameParts.slice(0, 2);

                if (firstTwo.length < 2) {

                    return;

                }

                const aliases = [
                    normalizeMriiaName(firstTwo.join(' ')),
                    normalizeMriiaName([...firstTwo].reverse().join(' ')),
                ];

                aliases.forEach(alias => {

                    const matchingRows = rowsByName.get(alias) || [];
                    matchingRows.push(row);
                    rowsByName.set(alias, matchingRows);

                });

            });

            const batchesByGroup = new Map();
            let unmatched = 0;
            let skipped = parsedClipboard.unsupported;

            grades.forEach(grade => {

                const matchingRows =
                    rowsByName.get(grade.normalizedName) || [];

                const uniqueRows = [...new Set(matchingRows)];

                if (uniqueRows.length !== 1) {

                    unmatched += 1;

                    return;

                }

                const row = uniqueRows[0];
                const targetCell = row.children[headerIndex + 1];

                if (!targetCell) {

                    skipped += 1;

                    return;

                }

                let selectedCell = null;
                let selectedGroupId = null;
                let selectedScoreValue = null;
                let selectedColumnDate = '';

                for (let columnIndex = headerIndex; columnIndex >= 1; columnIndex--) {

                    const dateHeader = header.parentElement.children[columnIndex];

                    if (!dateHeader) {

                        continue;

                    }

                    const dateHeaderClone = dateHeader.cloneNode(true);
                    dateHeaderClone
                        .querySelectorAll('.mriia-date-actions')
                        .forEach(dateActions => dateActions.remove());

                    const candidateDate =
                        dateHeaderClone.innerText.replace(/\s+/g, ' ').trim();

                    if (!/^\d{1,2}\/\d{1,2}$/.test(candidateDate)) {

                        continue;

                    }

                    const cell = row.children[columnIndex + 1];
                    const candidateGroupId =
                        scoreHeaderRow?.children[columnIndex + 1]
                            ?.getAttribute('data-group');

                    if (!cell || !candidateGroupId) {

                        continue;

                    }

                    const sameScope = scopeAttributes.every(attribute =>
                        cell.getAttribute(attribute) === targetCell.getAttribute(attribute)
                    );

                    if (
                        !sameScope ||
                        !cell.getAttribute('data-classlessonscoregroupid') ||
                        cell.getAttribute('data-classlessonscoregroupid') !== candidateGroupId ||
                        !['1', 'true'].includes(cell.getAttribute('data-is-available')) ||
                        cell.getAttribute('data-can-change-teacher') !== 'true' ||
                        cell.getAttribute('data-is-mark-editable') !== 'true'
                    ) {

                        continue;

                    }

                    const absenceMarker =
                        cell.querySelector('.table-eps-icon span._small')
                            ?.textContent.trim().toLocaleUpperCase('uk-UA');

                    if (absenceMarker === 'Н' || absenceMarker === 'H') {

                        continue;

                    }

                    const isEmpty =
                        typeof pageWindow.isEmptyAutoScoreCell === 'function' &&
                        typeof pageWindow.$ === 'function'
                            ? pageWindow.isEmptyAutoScoreCell(pageWindow.$(cell))
                            : cell.getAttribute('data-has-score') !== 'true' &&
                                !cell.getAttribute('data-score-value-id') &&
                                cell.getAttribute('data-is-comment-exist') !== 'true';

                    if (!isEmpty) {

                        continue;

                    }

                    let scoreValues = [];

                    try {

                        scoreValues = JSON.parse(
                            cell.getAttribute('data-score-values') || '[]'
                        );

                    } catch (error) {

                        log('Не вдалося прочитати допустимі оцінки клітинки:', error);

                    }

                    const scoreValue =
                        scoreValues.find(item => String(item.Value) === grade.value);

                    if (!scoreValue) {

                        continue;

                    }

                    selectedCell = cell;
                    selectedGroupId = candidateGroupId;
                    selectedScoreValue = scoreValue;
                    selectedColumnDate = candidateDate;

                    break;

                }

                if (!selectedCell) {

                    skipped += 1;

                    return;

                }

                const pupilId =
                    selectedCell.getAttribute('data-pupilid');

                if (!pupilId) {

                    skipped += 1;

                    return;

                }

                const batch = batchesByGroup.get(selectedGroupId) || {
                    scores: [],
                    dates: new Set(),
                };

                batch.scores.push({
                    PupilID: Number(pupilId),
                    ScoreValueID: Number(selectedScoreValue.ID),
                    ScoreCharacteristicID:
                        Number(selectedCell.getAttribute('data-educationalplancharachteristicid')) || null,
                });

                batch.dates.add(selectedColumnDate);
                batchesByGroup.set(selectedGroupId, batch);

            });

            const totalScores =
                [...batchesByGroup.values()]
                    .reduce((total, batch) => total + batch.scores.length, 0);

            if (!totalScores) {

                showMriiaPanelNotice(
                    `Оцінки не внесені. Не знайдено: ${unmatched}, пропущено: ${skipped}.`
                );

                return;

            }

            if (typeof pageWindow.$?.ajax !== 'function') {

                throw new Error('Штатне збереження оцінок Мрії недоступне.');

            }

            showMriiaPanelNotice(
                `Передаю оцінки: ${totalScores}; не знайдено: ${unmatched}; пропущено: ${skipped}.`
            );

            const savedBatches = [];

            for (const [candidateGroupId, batch] of batchesByGroup) {

                const response = await new Promise((resolve, reject) => {

                    pageWindow.$.ajax({
                        type: 'POST',
                        url: '/api/ScoreApi/SaveAutomaticScores',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            EducationalPlanID: 1,
                            ClassLessonScoreGroupID: Number(candidateGroupId),
                            Scores: batch.scores,
                        }),
                        success: resolve,
                        error: (xhr, status, error) => reject(
                            new Error(error || status || 'Помилка збереження оцінок.')
                        ),
                    });

                });

                if (!response?.success) {

                    throw new Error(
                        response?.message ||
                        `Мрія не зберегла пакет для уроку ${[...batch.dates].join(', ')}.`
                    );

                }

                savedBatches.push(...batch.dates);

            }

            if (typeof pageWindow.RefreshTableAfterAutoScore === 'function') {

                pageWindow.RefreshTableAfterAutoScore(false);

            }

            showMriiaPanelNotice(
                `Збережено: ${totalScores}; клітинки до ${date}; дати запису: ${[...new Set(savedBatches)].join(', ')}; не знайдено: ${unmatched}; пропущено: ${skipped}.`
            );

        } catch (error) {

            log('Імпорт оцінок не виконано:', error);
            showMriiaPanelNotice(`Імпорт не виконано: ${error.message}`);

        } finally {

            button.dataset.importing = 'false';
            updateMriiaDateButtonState(button);

        }

    }


    function getMriiaStudentGrades(table, getValue) {

        const grades = [];

        table?.querySelectorAll('tr').forEach(row => {

            const nameElement =
                row.querySelector('.pupil .table-user');

            if (!nameElement) {

                return;

            }

            const fullName =
                nameElement.dataset.mriiaFullName ||
                nameElement.textContent.trim();

            const nameParts =
                fullName.split(/\s+/).filter(Boolean).slice(0, 2);

            if (nameParts.length !== 2) {

                return;

            }

            grades.push({
                normalizedName: normalizeMriiaName(nameParts.join(' ')),
                value: String(getValue()),
            });

        });

        return grades;

    }


    function positionMriiaGradePicker(picker, button) {

        const bounds = button.getBoundingClientRect();
        const pickerBounds = picker.getBoundingClientRect();

        picker.style.left = `${Math.max(
            8,
            Math.min(bounds.left, window.innerWidth - pickerBounds.width - 8)
        )}px`;

        picker.style.top = `${Math.max(
            8,
            Math.min(bounds.bottom + 4, window.innerHeight - pickerBounds.height - 8)
        )}px`;

    }


    function openMriiaBulkGradePicker(header, date, bulkButton, importButton) {

        const existingPicker =
            document.querySelector('#mriia-bulk-grade-picker, #mriia-random-grade-picker');

        if (existingPicker) {

            const isSameButton =
                existingPicker.id === 'mriia-bulk-grade-picker' &&
                existingPicker.dataset.headerDate === date &&
                existingPicker.dataset.headerColumn === bulkButton.dataset.columnIndex;

            existingPicker.remove();

            if (isSameButton) {

                return;

            }

        }

        const picker = document.createElement('div');
        picker.id = 'mriia-bulk-grade-picker';
        picker.dataset.headerDate = date;
        picker.dataset.headerColumn = bulkButton.dataset.columnIndex;

        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Оцінка для всіх учнів');

        for (let grade = 1; grade <= 12; grade++) {

            const option = document.createElement('option');
            option.value = String(grade);
            option.textContent = String(grade);
            select.appendChild(option);

        }

        select.value = '10';

        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.textContent = 'ОК';
        confirmButton.title = `Виставити оцінку всім учням до ${date}`;

        confirmButton.addEventListener('click', event => {

            event.preventDefault();
            event.stopPropagation();

            const table = header.closest('.table-schedule');
            const grades = getMriiaStudentGrades(
                table,
                () => select.value
            );

            picker.remove();
            importClipboardGradesForColumn(
                header,
                importButton,
                date,
                grades
            );

        });

        picker.append(select, confirmButton);
        document.body.appendChild(picker);
        positionMriiaGradePicker(picker, bulkButton);

    }


    function openMriiaRandomGradePicker(header, date, randomButton, importButton) {

        const existingPicker =
            document.querySelector('#mriia-bulk-grade-picker, #mriia-random-grade-picker');

        if (existingPicker) {

            const isSameButton =
                existingPicker.id === 'mriia-random-grade-picker' &&
                existingPicker.dataset.headerDate === date &&
                existingPicker.dataset.headerColumn === randomButton.dataset.columnIndex;

            existingPicker.remove();

            if (isSameButton) {

                return;

            }

        }

        const picker = document.createElement('div');
        picker.id = 'mriia-random-grade-picker';
        picker.dataset.headerDate = date;
        picker.dataset.headerColumn = randomButton.dataset.columnIndex;

        const minSelect = document.createElement('select');
        minSelect.setAttribute('aria-label', 'Мінімальна оцінка');

        const maxSelect = document.createElement('select');
        maxSelect.setAttribute('aria-label', 'Максимальна оцінка');

        const minLabel = document.createElement('span');
        minLabel.textContent = 'від';

        const maxLabel = document.createElement('span');
        maxLabel.textContent = 'до';

        const createWeightControl = name => {

            const control = document.createElement('div');
            control.className = 'mriia-random-grade-weight-control';

            const options = document.createElement('div');
            options.className = 'mriia-random-grade-weights';

            [
                { value: 'less', text: 'менше' },
                { value: 'medium', text: 'середньо' },
                { value: 'more', text: 'більше' },
            ].forEach(option => {

                const optionLabel = document.createElement('label');
                optionLabel.title = option.text;
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = name;
                radio.value = option.value;
                radio.checked = option.value === 'medium';
                radio.setAttribute('aria-label', option.text);

                optionLabel.appendChild(radio);
                options.appendChild(optionLabel);

            });

            control.appendChild(options);

            return {
                element: control,
                getWeight() {
                    const selected =
                        control.querySelector('input:checked')?.value;

                    return selected === 'less' ? 0.5 : selected === 'more' ? 2 : 1;
                },
            };

        };

        const minWeightControl =
            createWeightControl('mriia-random-min-weight');

        const maxWeightControl =
            createWeightControl('mriia-random-max-weight');

        for (let grade = 1; grade <= 12; grade++) {

            [minSelect, maxSelect].forEach(select => {

                const option = document.createElement('option');
                option.value = String(grade);
                option.textContent = String(grade);
                select.appendChild(option);

            });

        }

        minSelect.value = '9';
        maxSelect.value = '10';

        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.textContent = 'ОК';
        confirmButton.title = 'Виставити випадкові оцінки у вибраному діапазоні';

        confirmButton.addEventListener('click', event => {

            event.preventDefault();
            event.stopPropagation();

            const minGrade = Number(minSelect.value);
            const maxGrade = Number(maxSelect.value);

            if (minGrade > maxGrade) {

                showMriiaPanelNotice('Мінімальна оцінка не може бути більшою за максимальну.');
                return;

            }

            const table = header.closest('.table-schedule');
            const minWeight = minWeightControl.getWeight();
            const maxWeight = maxWeightControl.getWeight();
            const gradeWeights = [];

            for (let grade = minGrade; grade <= maxGrade; grade++) {

                let weight = 1;

                if (grade === minGrade) {

                    weight *= minWeight;

                }

                if (grade === maxGrade) {

                    weight *= maxWeight;

                }

                gradeWeights.push({ grade, weight });

            }

            const totalWeight =
                gradeWeights.reduce((total, item) => total + item.weight, 0);

            const grades = getMriiaStudentGrades(table, () => {

                let randomWeight = Math.random() * totalWeight;

                for (const item of gradeWeights) {

                    randomWeight -= item.weight;

                    if (randomWeight < 0) {

                        return item.grade;

                    }

                }

                return gradeWeights[gradeWeights.length - 1].grade;

            });

            picker.remove();
            importClipboardGradesForColumn(
                header,
                importButton,
                date,
                grades
            );

        });

        const minControl = document.createElement('div');
        minControl.className = 'mriia-random-grade-control';
        minControl.append(minLabel, minSelect, minWeightControl.element);

        const maxControl = document.createElement('div');
        maxControl.className = 'mriia-random-grade-control';
        maxControl.append(maxLabel, maxSelect, maxWeightControl.element);

        picker.append(minControl, maxControl, confirmButton);
        document.body.appendChild(picker);
        positionMriiaGradePicker(picker, randomButton);

    }


    function initMriiaDateButtons() {

        if (location.pathname !== '/Diary') {

            return;

        }

        const dateHeaders =
            [...document.querySelectorAll('.table-schedule th')]
                .map(header => {

                    const clone = header.cloneNode(true);

                    clone.querySelectorAll('.mriia-date-actions')
                        .forEach(button => button.remove());

                    return {
                        header,
                        date: clone.innerText.replace(/\s+/g, ' ').trim(),
                    };

                })
                .filter(item => /^\d{1,2}\/\d{1,2}$/.test(item.date));

        dateHeaders.forEach(({ header, date }) => {
            const columnIndex =
                [...header.parentElement.children].indexOf(header);

            header.parentElement.classList.add('mriia-date-row');
            header.classList.add('mriia-date-header');

            let button =
                header.querySelector('.mriia-date-column-button');

            let actions =
                header.querySelector('.mriia-date-actions');

            let bulkButton =
                header.querySelector('.mriia-bulk-grade-button');

            let randomButton =
                header.querySelector('.mriia-random-grade-button');

            if (!button) {

                button = document.createElement('button');
                button.type = 'button';
                button.className = 'mriia-date-column-button';
                button.textContent = '↓';
                button.title = `Імпортувати оцінки для ${date}`;
                button.setAttribute('aria-label', `Імпортувати оцінки для ${date}`);
                button.dataset.columnIndex = String(columnIndex);
                button.dataset.importing = 'false';

                button.addEventListener('click', event => {

                    event.preventDefault();
                    event.stopPropagation();

                    importClipboardGradesForColumn(header, button, date);

                });

            }

            if (!actions) {

                actions = document.createElement('div');
                actions.className = 'mriia-date-actions';

                const dateLabel =
                    [...header.children].find(child =>
                        child.classList.contains('table-eps-icon') === false &&
                        child.textContent.replace(/\s+/g, ' ').trim() === date
                    );

                header.insertBefore(actions, dateLabel || header.firstChild);

            }

            if (button.parentElement !== actions) {

                actions.appendChild(button);

            }

            if (!bulkButton) {

                bulkButton = document.createElement('button');
                bulkButton.type = 'button';
                bulkButton.className = 'mriia-bulk-grade-button';
                bulkButton.textContent = '1-12';
                bulkButton.title = 'Виставити одну оцінку всім учням';
                bulkButton.setAttribute(
                    'aria-label',
                    'Виставити одну оцінку всім учням'
                );

                bulkButton.addEventListener('click', event => {

                    event.preventDefault();
                    event.stopPropagation();

                    openMriiaBulkGradePicker(
                        header,
                        date,
                        bulkButton,
                        button
                    );

                });

            }

            if (bulkButton.parentElement !== actions) {

                actions.appendChild(bulkButton);

            }

            if (!randomButton) {

                randomButton = document.createElement('button');
                randomButton.type = 'button';
                randomButton.className = 'mriia-random-grade-button';
                randomButton.textContent = '🎲';
                randomButton.title = 'Виставити випадкові оцінки в заданих межах';
                randomButton.setAttribute(
                    'aria-label',
                    'Виставити випадкові оцінки в заданих межах'
                );

                randomButton.addEventListener('click', event => {

                    event.preventDefault();
                    event.stopPropagation();

                    openMriiaRandomGradePicker(
                        header,
                        date,
                        randomButton,
                        button
                    );

                });

            }

            if (randomButton.parentElement !== actions) {

                actions.appendChild(randomButton);

            }

            button.dataset.columnIndex = String(columnIndex);
            bulkButton.dataset.columnIndex = String(columnIndex);
            randomButton.dataset.columnIndex = String(columnIndex);
            updateMriiaDateButtonState(button);

        });

    }

    function buildMriiaResult(status) {

        const breadcrumb =
            document.querySelector('main nav');

        const breadcrumbParts =
            [...(breadcrumb?.querySelectorAll('li') || [])]
                .map(item => item.textContent.replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .filter(text => text !== 'Журнали');

        const className =
            breadcrumb?.querySelector('a[href*="/SchoolDiary/ClassDiary/"]')
                ?.textContent.trim() || '';

        const lessonName =
            className
                ? breadcrumbParts.slice(breadcrumbParts.indexOf(className) + 1).join(' ')
                : breadcrumbParts.join(' ');

        const context =
            [className, lessonName].filter(Boolean).join(' ');

        const students =
            [...selectedMriiaStudents.values()];

        const resultStatus =
            students.length ? status : 'присутні всі';

        const lines = [
            `${context || 'Журнал Мрії'} ${resultStatus}`,
            ...students,
        ];

        return {
            text: lines.join('\n'),
            count: students.length,
            className: context,
            status: resultStatus,
            students,
            timestamp: Date.now(),
        };

    }


    function initMriiaButtons() {

        if (!document.body) {

            return;

        }

        const buttonConfigs = [
            {
                id: 'mriia-absent-button',
                text: '🔴',
                bottom: 20,
                title: 'Відсутні — передати у WhatsApp',
                background: '#ffcdd2',
                status: 'відсутні',
            },
            {
                id: 'mriia-present-button',
                text: '🟢',
                bottom: 82,
                title: 'Присутні — передати у WhatsApp',
                background: '#c8e6c9',
                status: 'присутні',
            },
        ];

        buttonConfigs.forEach(config => {

            const button = createButton(config);

            if (button.dataset.mriiaPreviewBound !== 'true') {

                button.dataset.mriiaPreviewBound = 'true';

                const showPreview = () => {

                    mriiaPanelPreview =
                        buildMriiaResult(config.status).text;

                    renderMriiaPanel();

                };

                const hidePreview = () => {

                    mriiaPanelPreview = '';

                    renderMriiaPanel();

                };

                button.addEventListener('mouseenter', showPreview);
                button.addEventListener('mouseleave', hidePreview);
                button.addEventListener('focus', showPreview);
                button.addEventListener('blur', hidePreview);

            }

            button.onclick = async function () {

                button.style.transform = 'scale(0.9)';

                setTimeout(() => {

                    button.style.transform = 'scale(1)';

                }, 150);

                const transferred = await startWhatsAppTransfer(
                    config.status,
                    buildMriiaResult
                );

                if (transferred) {

                    clearMriiaSelection();

                }

            };

        });

        let panel =
            document.getElementById('mriia-student-panel');

        if (!panel) {

            panel = document.createElement('div');
            panel.id = 'mriia-student-panel';

            const content = document.createElement('div');
            content.id = 'mriia-student-panel-content';
            panel.appendChild(content);
            document.body.appendChild(panel);

        }

        renderMriiaPanel();

    }


    // ============================================================
    // OBSERVER CLASSROOM
    // ============================================================

    function startClassroomObserver() {


        if (!document.body) {

            return;

        }


        initClassroomButtons();


        const observer =
            new MutationObserver(
                () => {


                    if (

                        !document.getElementById(
                            'classroom-absent-button'
                        )

                        ||

                        !document.getElementById(
                            'classroom-present-button'
                        )

                    ) {

                        initClassroomButtons();

                    }

                }
            );


        observer.observe(
            document.body,
            {

                childList:
                    true,

                subtree:
                    true

            }
        );

    }


    // ============================================================
    // START CLASSROOM
    // ============================================================

    function startClassroom() {


        log(
            'Запуск Classroom'
        );


        startClassroomWhatsAppMonitor();


        if (
            document.readyState ===
            'loading'
        ) {


            document.addEventListener(

                'DOMContentLoaded',

                startClassroomObserver,

                {
                    once:
                        true
                }

            );


        } else {


            startClassroomObserver();


        }

    }


    // ============================================================
    // WHATSAPP
    // ============================================================


    // ============================================================
    // ПОШУК ЧАТУ
    // ============================================================

    function findChat() {


        const selector =

            '[data-testid="cell-frame-title"] ' +

            `span[title="${WHATSAPP_CHAT_NAME}"]`;


        const title =
            document.querySelector(
                selector
            );


        if (!title) {

            return null;

        }


        log(
            'Назву чату знайдено:',
            title.getAttribute(
                'title'
            )
        );


        const container =
            title.closest(
                '[data-testid="cell-frame-container"]'
            );


        if (!container) {

            return null;

        }


        let row =
            container;


        for (
            let i = 0;
            i < 8;
            i++
        ) {


            if (
                !row.parentElement
            ) {

                break;

            }


            row =
                row.parentElement;


            const titleInside =
                row.querySelector(

                    '[data-testid="cell-frame-title"] ' +

                    `span[title="${WHATSAPP_CHAT_NAME}"]`

                );


            if (titleInside) {


                return {

                    title:
                        title,

                    container:
                        container,

                    row:
                        row

                };


            }

        }


        return {

            title:
                title,

            container:
                container,

            row:
                container

        };

    }


    // ============================================================
    // ПЕРЕВІРКА ВІДКРИТОГО ЧАТУ
    // ============================================================

    function isChatHeaderOpen() {


        const header =
            document.querySelector(

                '[data-testid="conversation-info-header-chat-title"]'

            );


        if (!header) {

            return false;

        }


        const text =
            header.textContent
                .replace(/\s+/g, ' ')
                .trim();


        log(
            'Заголовок:',
            text
        );


        return (
            text ===
            WHATSAPP_CHAT_NAME
        );

    }


    // ============================================================
    // КЛІК ПО ЧАТУ
    // ============================================================

    async function forceClickChat(chat) {


        if (!chat) {

            return false;

        }


        try {

            chat.row.scrollIntoView({

                behavior:
                    'instant',

                block:
                    'center'

            });

        } catch (error) {

            log(
                'scroll:',
                error
            );

        }


        // --------------------------------------------------------
        // Клік 1
        // --------------------------------------------------------

        try {

            chat.row.click();


            log(
                'row.click() виконано'
            );

        } catch (error) {

            log(
                'row.click:',
                error
            );

        }


        await sleep(1500);


        if (
            isChatHeaderOpen()
        ) {

            return true;

        }


        // --------------------------------------------------------
        // Клік 2
        // --------------------------------------------------------

        try {

            chat.title.click();


            log(
                'title.click() виконано'
            );

        } catch (error) {

            log(
                'title.click:',
                error
            );

        }


        await sleep(1500);


        if (
            isChatHeaderOpen()
        ) {

            return true;

        }


        // --------------------------------------------------------
        // Клік 3
        // --------------------------------------------------------

        try {


            const element =
                chat.title;


            element.dispatchEvent(

                new MouseEvent(
                    'mousedown',
                    {

                        bubbles:
                            true,

                        cancelable:
                            true,

                        button:
                            0

                    }
                )

            );


            await sleep(100);


            element.dispatchEvent(

                new MouseEvent(
                    'mouseup',
                    {

                        bubbles:
                            true,

                        cancelable:
                            true,

                        button:
                            0

                    }
                )

            );


            await sleep(100);


            element.dispatchEvent(

                new MouseEvent(
                    'click',
                    {

                        bubbles:
                            true,

                        cancelable:
                            true,

                        button:
                            0

                    }
                )

            );


            log(
                'MouseEvents виконано'
            );


        } catch (error) {

            log(
                'MouseEvents:',
                error
            );

        }


        await sleep(2000);


        return isChatHeaderOpen();

    }


    // ============================================================
    // ПОШУК ПОЛЯ ПОВІДОМЛЕННЯ
    // ============================================================

    function findMessageBox() {


        const p =
            document.querySelector(
                'p.selectable-text.copyable-text'
            );


        if (p) {


            const editor =
                p.closest(
                    '[contenteditable="true"]'
                );


            if (editor) {

                return editor;

            }

        }


        let editor =
            document.querySelector(

                '[contenteditable="true"][role="textbox"]'

            );


        if (editor) {

            return editor;

        }


        editor =
            document.querySelector(
                '[contenteditable="true"]'
            );


        return editor || null;

    }


    // ============================================================
    // ОЧИЩЕННЯ РЕДАКТОРА
    // ============================================================

    function clearEditor(editor) {


        if (!editor) {

            return;

        }


        editor.focus();


        const selection =
            window.getSelection();


        const range =
            document.createRange();


        range.selectNodeContents(
            editor
        );


        selection.removeAllRanges();


        selection.addRange(
            range
        );


        try {

            document.execCommand(
                'delete',
                false,
                null
            );

        } catch (error) {

            log(
                'delete:',
                error
            );

        }


        while (
            editor.firstChild
        ) {

            editor.removeChild(
                editor.firstChild
            );

        }


        const p =
            document.createElement(
                'p'
            );


        p.className =
            'selectable-text copyable-text';


        const br =
            document.createElement(
                'br'
            );


        br.setAttribute(
            'data-lexical-managed-linebreak',
            'true'
        );


        p.appendChild(
            br
        );


        editor.appendChild(
            p
        );


        const newRange =
            document.createRange();


        newRange.selectNodeContents(
            p
        );


        newRange.collapse(
            false
        );


        selection.removeAllRanges();


        selection.addRange(
            newRange
        );


        editor.focus();


        log(
            'Редактор очищено'
        );

    }


    // ============================================================
    // ВСТАВКА ТЕКСТУ
    // ============================================================

    async function pasteTextIntoEditor(
        editor,
        text
    ) {


        if (
            !editor ||
            !text
        ) {

            return false;

        }


        editor.focus();


        await sleep(200);


        const selection =
            window.getSelection();


        const range =
            document.createRange();


        range.selectNodeContents(
            editor
        );


        selection.removeAllRanges();


        selection.addRange(
            range
        );


        // ========================================================
        // CLIPBOARD EVENT
        // ========================================================

        try {


            const dataTransfer =
                new DataTransfer();


            dataTransfer.setData(
                'text/plain',
                text
            );


            dataTransfer.setData(

                'text/html',

                text

                    .replace(
                        /&/g,
                        '&amp;'
                    )

                    .replace(
                        /</g,
                        '&lt;'
                    )

                    .replace(
                        />/g,
                        '&gt;'
                    )

                    .replace(
                        /\n/g,
                        '<br>'
                    )

            );


            const pasteEvent =
                new ClipboardEvent(
                    'paste',
                    {

                        bubbles:
                            true,

                        cancelable:
                            true,

                        clipboardData:
                            dataTransfer

                    }
                );


            editor.dispatchEvent(
                pasteEvent
            );


            await sleep(500);


            const currentText =
                editor.innerText ||
                editor.textContent ||
                '';


            const firstLine =
                text.split('\n')[0];


            if (
                currentText.includes(
                    firstLine
                )
            ) {

                log(
                    'Текст вставлено'
                );


                return true;

            }


        } catch (error) {

            log(
                'ClipboardEvent:',
                error
            );

        }


        // ========================================================
        // FALLBACK
        // ========================================================

        try {


            const selection2 =
                window.getSelection();


            const range2 =
                document.createRange();


            range2.selectNodeContents(
                editor
            );


            selection2.removeAllRanges();


            selection2.addRange(
                range2
            );


            document.execCommand(

                'insertText',

                false,

                text

            );


            await sleep(500);


            return true;


        } catch (error) {

            log(
                'Fallback:',
                error
            );


            return false;

        }

    }


    // ============================================================
    // ВСТАВИТИ PAYLOAD У WHATSAPP
    // ============================================================

    async function insertPayloadIntoWhatsApp(
        payload
    ) {


        if (
            !payload ||
            !payload.text
        ) {

            log(
                'Payload порожній'
            );


            return;

        }


        log(
            'Отримано новий payload:',
            payload
        );


        // --------------------------------------------------------
        // Чекаємо чат
        // --------------------------------------------------------

        const chat =
            await waitForChat(
                60000
            );


        if (!chat) {

            log(
                `Не знайдено чат "${WHATSAPP_CHAT_NAME}".`
            );


            return;

        }


        // --------------------------------------------------------
        // Відкриваємо чат
        // --------------------------------------------------------

        const opened =
            await forceClickChat(
                chat
            );


        if (!opened) {

            log(
                `Не вдалося відкрити чат "${WHATSAPP_CHAT_NAME}".`
            );


            return;

        }


        // --------------------------------------------------------
        // Чекаємо редактор
        // --------------------------------------------------------

        const editor =
            await waitForMessageBox(
                30000
            );


        if (!editor) {

            log(
                'Поле повідомлення WhatsApp не знайдено.'
            );


            return;

        }


        // --------------------------------------------------------
        // ОЧИЩАЄМО
        // --------------------------------------------------------

        clearEditor(
            editor
        );


        await sleep(300);


        // --------------------------------------------------------
        // ВСТАВЛЯЄМО
        // --------------------------------------------------------

        await pasteTextIntoEditor(

            editor,

            payload.text

        );


        log(
            'Готово.'
        );


        log(
            'Повідомлення НЕ відправлялося.'
        );

    }


    // ============================================================
    // ОЧІКУВАННЯ ЧАТУ
    // ============================================================

    async function waitForChat(
        timeout = 60000
    ) {


        const start =
            Date.now();


        while (
            Date.now() - start <
            timeout
        ) {


            const chat =
                findChat();


            if (chat) {

                return chat;

            }


            await sleep(
                1000
            );

        }


        return null;

    }


    // ============================================================
    // ОЧІКУВАННЯ РЕДАКТОРА
    // ============================================================

    async function waitForMessageBox(
        timeout = 30000
    ) {


        const start =
            Date.now();


        while (
            Date.now() - start <
            timeout
        ) {


            const editor =
                findMessageBox();


            if (editor) {

                return editor;

            }


            await sleep(
                1000
            );

        }


        return null;

    }


    // ============================================================
    // СЛУХАЧ GM STORAGE
    //
    // ЦЕ ОСНОВНА НОВА ФУНКЦІЯ v5.9
    // ============================================================

    function startWhatsAppTransferListener() {


        if (
            typeof GM_addValueChangeListener !==
            'function'
        ) {

            log(
                'GM_addValueChangeListener недоступний'
            );


            return;

        }


        GM_addValueChangeListener(

            TRANSFER_KEY,

            async function (
                name,
                oldValue,
                newValue,
                remote
            ) {


                log(
                    'Отримано сигнал transfer'
                );


                log(
                    'remote:',
                    remote
                );


                if (!newValue) {

                    return;

                }


                // ------------------------------------------------
                // Перевіряємо timestamp
                // ------------------------------------------------

                if (
                    !newValue.timestamp
                ) {

                    return;

                }


                // ------------------------------------------------
                // Якщо це не remote-зміна,
                // нічого не робимо
                // ------------------------------------------------

                if (!remote) {

                    log(
                        'Зміна локальна — пропускаємо'
                    );


                    return;

                }


                log(
                    'Новий запит із Classroom:',
                    newValue
                );


                // Якщо WhatsApp уже був відкритий, робимо його
                // активною вкладкою замість створення дубліката.
                window.focus();


                // ------------------------------------------------
                // Невелика затримка,
                // щоб WhatsApp не переривав свою навігацію
                // ------------------------------------------------

                await sleep(500);


                await insertPayloadIntoWhatsApp(

                    newValue

                );

            }

        );


        log(
            'GM listener запущено'
        );

    }


    // ============================================================
    // START WHATSAPP
    // ============================================================

    function startWhatsApp() {


        log(
            'Запуск WhatsApp'
        );


        const heartbeat =
            () => GM_setValue(
                WHATSAPP_HEARTBEAT_KEY,
                Date.now()
            );


        heartbeat();


        setInterval(
            heartbeat,
            WHATSAPP_HEARTBEAT_INTERVAL
        );


        // --------------------------------------------------------
        // Встановлюємо listener одразу
        // --------------------------------------------------------

        startWhatsAppTransferListener();


        // --------------------------------------------------------
        // Якщо WhatsApp тільки-но відкрився,
        // перевіряємо останній payload.
        // --------------------------------------------------------

        setTimeout(
            async () => {


                try {


                    const payload =
                        await GM_getValue(
                            PAYLOAD_KEY,
                            null
                        );


                    if (
                        payload &&
                        payload.text
                    ) {


                        const age =
                            Date.now() -
                            (
                                payload.timestamp ||
                                0
                            );


                        // Якщо запит був не старший
                        // 2 хвилин
                        if (
                            age < 120000
                        ) {


                            log(
                                'Знайдено свіжий payload'
                            );


                            await insertPayloadIntoWhatsApp(

                                payload

                            );

                        }

                    }


                } catch (error) {

                    log(
                        'Помилка стартової перевірки:',
                        error
                    );

                }


            },

            WHATSAPP_START_DELAY

        );

    }


    // ============================================================
    // КОМПАКТНИЙ ЖУРНАЛ МРІЇ
    // ============================================================

    function calculateMriiaDiaryCompletion(table) {

        const rows =
            [...table.querySelectorAll('tr')];

        const dateHeaders =
            rows[0]?.children;

        const scoreHeaders =
            rows[1]?.children;

        if (!dateHeaders || !scoreHeaders) {

            throw new Error('У журналі не знайдено заголовки таблиці.');

        }

        const today = new Date();
        const todayDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
            999
        );

        const academicStartYear =
            today.getMonth() + 1 >= 9
                ? today.getFullYear()
                : today.getFullYear() - 1;

        let previousMonth = null;
        let headerYear = null;
        let total = 0;
        let filled = 0;
        const studentRows =
            rows.slice(2)
                .filter(row => row.querySelector('.pupil .table-user'));

        for (let columnIndex = 1; columnIndex < dateHeaders.length; columnIndex++) {

            const dateHeader = dateHeaders[columnIndex].cloneNode(true);

            dateHeader
                .querySelectorAll('.mriia-date-actions, .table-eps-icon')
                .forEach(element => element.remove());

            const match =
                dateHeader.textContent.replace(/\s+/g, ' ').trim()
                    .match(/^(\d{1,2})\/(\d{1,2})$/);

            if (!match) {

                continue;

            }

            const day = Number(match[1]);
            const month = Number(match[2]);

            if (day < 1 || day > 31 || month < 1 || month > 12) {

                continue;

            }

            if (headerYear === null) {

                headerYear =
                    month >= 9
                        ? academicStartYear
                        : academicStartYear + 1;

            } else if (month < previousMonth) {

                headerYear += 1;

            }

            previousMonth = month;

            const lessonDate =
                new Date(headerYear, month - 1, day, 23, 59, 59, 999);

            if (
                lessonDate.getFullYear() !== headerYear ||
                lessonDate.getMonth() !== month - 1 ||
                lessonDate > todayDate
            ) {

                continue;

            }

            const groupId =
                scoreHeaders[columnIndex + 1]?.getAttribute('data-group');

            if (!groupId) {

                continue;

            }

            studentRows.forEach(row => {

                const cell = row.children[columnIndex + 1];

                if (
                    !cell ||
                    cell.getAttribute('data-classlessonscoregroupid') !== groupId ||
                    cell.getAttribute('data-is-available') !== '1'
                ) {

                    return;

                }

                const absenceMarker =
                    cell.querySelector('.table-eps-icon span._small')
                        ?.textContent.trim().toLocaleUpperCase('uk-UA');

                if (absenceMarker === 'Н' || absenceMarker === 'H') {

                    return;

                }

                total += 1;

                if (
                    cell.getAttribute('data-has-score') === 'true' ||
                    Boolean(cell.getAttribute('data-score-value-id'))
                ) {

                    filled += 1;

                }

            });

        }

        return { total, filled };

    }


    function readMriiaDiaryCompletion(url) {

        return new Promise((resolve, reject) => {

            const frame = document.createElement('iframe');
            frame.title = 'Фоновий підрахунок заповнення журналу';
            frame.setAttribute('aria-hidden', 'true');
            frame.tabIndex = -1;
            frame.style.cssText = [
                'position:fixed',
                'left:-10000px',
                'top:0',
                'width:1280px',
                'height:800px',
                'border:0',
                'opacity:0',
                'pointer-events:none',
            ].join(';');

            const frameUrl = new URL(url);
            frameUrl.searchParams.set('mriiaCompletionScan', '1');

            let pollId = null;
            let timeoutId = null;
            let settled = false;

            const finish = (callback, value) => {

                if (settled) {

                    return;

                }

                settled = true;
                clearInterval(pollId);
                clearTimeout(timeoutId);
                frame.remove();
                callback(value);

            };

            const inspectFrame = () => {

                try {

                    const table =
                        frame.contentDocument?.querySelector('.table-schedule');

                    const rows =
                        table?.querySelectorAll('tr');

                    if (
                        table &&
                        rows?.length > 2 &&
                        rows[1].querySelector('[data-group]')
                    ) {

                        finish(
                            resolve,
                            calculateMriiaDiaryCompletion(table)
                        );

                    }

                } catch (error) {

                    finish(
                        reject,
                        new Error(`Не вдалося прочитати журнал: ${error.message}`)
                    );

                }

            };

            frame.addEventListener('load', inspectFrame);
            document.body.appendChild(frame);

            pollId = setInterval(inspectFrame, 250);
            timeoutId = setTimeout(() => {

                finish(
                    reject,
                    new Error('Не вдалося завантажити журнал за відведений час.')
                );

            }, 20000);

            frame.src = frameUrl.href;

        });

    }


    function startMriiaCompletionDisplay() {

        if (
            location.pathname.replace(/\/+$/, '') !==
            '/diaries/subjects/my'
        ) {

            return;

        }

        const styleId =
            'mriia-diary-completion-style';

        const results = new Map();
        const queuedUrls = new Set();
        const activeUrls = new Set();
        const queue = [];
        let activeScans = 0;
        let scanStartTimer = null;
        let lastReportedCardCount = -1;
        let scheduledCardCheck = null;
        let cardRoot = null;
        let cardObserver = null;
        let lastShadowState = '';

        log(
            `Індикатор журналів запущено: v${SCRIPT_VERSION} ${SCRIPT_BUILD_TIMESTAMP}`,
            location.href
        );

        const isDiaryLink = link => {

            const url = new URL(link.href, location.href);
            const paramNames =
                [...url.searchParams.keys()]
                    .map(name => name.toLocaleLowerCase());

            return url.origin === location.origin &&
                url.pathname.toLocaleLowerCase() === '/diary' &&
                paramNames.includes('classid');

        };

        const getDiaryLinks = () =>
            [...(cardRoot?.querySelectorAll('a[href^="/Diary?"]') || [])]
                .filter(isDiaryLink);

        const cardRowSelector =
            'div.flex.items-center.gap-1.min-w-0';

        const isClassCardRow = row => {

            const labels =
                [...row.querySelectorAll('span')]
                    .map(label => label.textContent.replace(/\s+/g, ' ').trim());

            return labels.some(label =>
                /^\d{1,2}[-‑–][А-ЯІЇЄҐA-Z]/i.test(label)
            );

        };

        const getClassGroupRows = () =>
            [...(cardRoot?.querySelectorAll(cardRowSelector) || [])]
                .filter(isClassCardRow);

        const ensureShadowStyle = () => {

            if (!cardRoot || cardRoot.querySelector(`#${styleId}`)) {

                return;

            }

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .mriia-diary-completion-badge {
                    display: inline-flex;
                    flex: 0 0 auto;
                    align-items: center;
                    justify-content: center;
                    min-width: 48px;
                    height: 30px;
                    margin-left: auto;
                    margin-right: 0;
                    padding: 0 10px;
                    border: 1px solid #b7dfb9;
                    border-radius: 14px;
                    background: #e8f5e9;
                    color: #256029;
                    font: 600 12px/1.3 sans-serif;
                    white-space: nowrap;
                    pointer-events: none;
                    box-sizing: border-box;
                }
            `;
            cardRoot.appendChild(style);

        };

        const setBadgeResult = (url, result) => {

            cardRoot
                ?.querySelectorAll('.mriia-diary-completion-badge')
                .forEach(badge => {

                    if (badge.dataset.diaryUrl !== url) {

                        return;

                    }

                    if (result.error) {

                        if (badge.textContent !== '--%') {

                            badge.textContent = '--%';

                        }

                        const errorTitle =
                            `Не вдалося порахувати заповнення: ${result.error}`;

                        if (badge.title !== errorTitle) {

                            badge.title = errorTitle;

                        }

                        return;

                    }

                    const nextText = result.total
                        ? `${Math.round(result.filled * 100 / result.total)}%`
                        : '--%';

                    const nextTitle = result.total
                        ? `Заповнено оцінок: ${result.filled} із ${result.total} клітинок до сьогодні`
                        : 'До сьогодні немає доступних клітинок для оцінювання';

                    if (badge.textContent !== nextText) {

                        badge.textContent = nextText;

                    }

                    if (badge.title !== nextTitle) {

                        badge.title = nextTitle;

                    }

                });

        };

        const runQueue = () => {

            if (
                activeScans >= 2 ||
                !queue.length ||
                scanStartTimer !== null
            ) {

                return;

            }

            scanStartTimer = setTimeout(() => {

                scanStartTimer = null;

                if (activeScans >= 2 || !queue.length) {

                    return;

                }

                const url = queue.shift();
                queuedUrls.delete(url);
                activeUrls.add(url);
                activeScans += 1;
                log('Починаю підрахунок журналу:', url);

                readMriiaDiaryCompletion(url)
                    .then(result => {

                        results.set(url, result);
                        setBadgeResult(url, result);
                        log(
                            'Заповнення журналу пораховано:',
                            url,
                            `${result.filled}/${result.total}`,
                            result.total
                                ? `${Math.round(result.filled * 100 / result.total)}%`
                                : '--%'
                        );

                    })
                    .catch(error => {

                        const result = { error: error.message };
                        results.set(url, result);
                        setBadgeResult(url, result);
                        log('Не вдалося порахувати заповнення журналу:', error);

                    })
                    .finally(() => {

                        activeUrls.delete(url);
                        activeScans -= 1;
                        runQueue();

                    });

            }, 500);

        };

        const updateSubjectCards = () => {

            const links = getDiaryLinks();
            const diaryLinksByRow = new Map(
                links.map(link => [
                    link.querySelector(cardRowSelector),
                    link,
                ]).filter(([row]) => row)
            );
            const cardRows = getClassGroupRows();

            if (cardRows.length !== lastReportedCardCount) {

                lastReportedCardCount = cardRows.length;
                log(
                    `Знайдено карток журналів: ${cardRows.length} (посилань для підрахунку: ${links.length})`
                );

            }

            ensureShadowStyle();

            cardRows.forEach(classGroupRow => {

                const link =
                    diaryLinksByRow.get(classGroupRow) ||
                    classGroupRow.closest('a[href]');

                const diaryUrl = link && isDiaryLink(link)
                    ? (() => {
                        const url = new URL(link.href, location.href);
                        url.hash = '';
                        url.searchParams.delete('mriiaCompletionScan');
                        return url.href;
                    })()
                    : '';

                let badge =
                    classGroupRow.querySelector('.mriia-diary-completion-badge');

                if (!badge) {

                    badge = document.createElement('span');
                    badge.className = 'mriia-diary-completion-badge';
                    badge.dataset.diaryUrl = diaryUrl;
                    badge.textContent = '--%';
                    badge.title = 'Підрахунок заповнення журналу ще не завершено';
                    classGroupRow.appendChild(badge);

                } else if (badge.dataset.diaryUrl !== diaryUrl) {

                    badge.dataset.diaryUrl = diaryUrl;
                    badge.textContent = '--%';
                    badge.title = 'Підрахунок заповнення журналу ще не завершено';

                }

                if (!diaryUrl) {

                    if (link) {

                        log(
                            'Картку класу/групи знайдено, але посилання на журнал не розпізнано:',
                            link.getAttribute('href')
                        );

                    } else {

                        log(
                            'Рядок класу/групи знайдено без посилання-картки:',
                            classGroupRow.textContent.replace(/\s+/g, ' ').trim()
                        );

                    }

                    return;

                }

                if (results.has(diaryUrl)) {

                    setBadgeResult(diaryUrl, results.get(diaryUrl));

                } else if (
                    !queuedUrls.has(diaryUrl) &&
                    !activeUrls.has(diaryUrl)
                ) {

                    queuedUrls.add(diaryUrl);
                    queue.push(diaryUrl);

                }

            });

            runQueue();

        };

        const start = () => {

            if (document.body) {

                const scheduleCardCheck = () => {

                    if (scheduledCardCheck !== null) {

                        clearTimeout(scheduledCardCheck);

                    }

                    scheduledCardCheck = setTimeout(() => {

                        scheduledCardCheck = null;
                        attachShadowRoot();
                        updateSubjectCards();

                    }, 500);

                };

                const attachShadowRoot = () => {

                    const host =
                        document.querySelector('#react-app-root');
                    const shadowRoot =
                        host?.shadowRoot || null;
                    const shadowState = host
                        ? shadowRoot
                            ? `shadow-ready:${shadowRoot.childElementCount}`
                            : 'host-found-shadow-pending'
                        : 'host-missing';

                    if (shadowState !== lastShadowState) {

                        lastShadowState = shadowState;
                        log(
                            'Shadow DOM сторінки журналів:',
                            shadowState
                        );

                    }

                    if (!shadowRoot) {

                        return false;

                    }

                    if (cardRoot !== shadowRoot) {

                        cardRoot = shadowRoot;
                        ensureShadowStyle();

                        cardObserver?.disconnect();
                        cardObserver = new MutationObserver(records => {

                            const hasCardChanges = records.some(record =>
                                [...record.addedNodes].some(node =>
                                    node.nodeType === Node.ELEMENT_NODE &&
                                    (
                                        node.matches(cardRowSelector) ||
                                        node.matches('a[href^="/Diary?"]') ||
                                        node.querySelector(cardRowSelector) ||
                                        node.querySelector('a[href^="/Diary?"]')
                                    )
                                )
                            );

                            if (hasCardChanges) {

                                scheduleCardCheck();

                            }

                        });
                        cardObserver.observe(cardRoot, {
                            childList: true,
                            subtree: true,
                        });

                    }

                    return true;

                };

                scheduleCardCheck();

                setInterval(() => {

                    attachShadowRoot();
                    updateSubjectCards();

                }, 500);

            }

            if (document.head) {

                const updateTitle = () => {

                    const suffix =
                        `| v${SCRIPT_VERSION} ${SCRIPT_BUILD_TIMESTAMP}`;
                    const baseTitle =
                        document.title
                            .replace(
                                /(?:\s*\|\s*(?:\u0421\u043A\u0440\u0438\u043F\u0442\s+\S+\s+\u2022\s+[^|]+|v\d+(?:\.\d+)*\s+\d{1,2}\.\d{1,2}\.\d{2}\s+\d{1,2}:\d{2}))+/g,
                                ''
                            )
                            .trim();
                    const nextTitle =
                        `${baseTitle || 'Мрія'} ${suffix}`;

                    if (document.title !== nextTitle) {

                        document.title = nextTitle;

                    }

                };

                updateTitle();

                const titleElement =
                    document.querySelector('title');

                if (titleElement) {

                    new MutationObserver(updateTitle).observe(
                        titleElement,
                        {
                            childList: true,
                            characterData: true,
                            subtree: true,
                        }
                    );

                }

            }

        };

        if (document.readyState === 'loading') {

            document.addEventListener('DOMContentLoaded', start, { once: true });

        } else {

            start();

        }

    }


    function startMriiaGradesDisplay() {

        const scoreEditorStyleId =
            'mriia-score-editor-hidden-style';

        const hideScoreEditor = () => {

            if (
                document.getElementById(scoreEditorStyleId) ||
                !document.documentElement
            ) {

                return;

            }

            const style = document.createElement('style');
            style.id = scoreEditorStyleId;
            style.textContent = `
                .mrmodal:has(.mrmodal-content.diary-keyboard-modal-passive) {
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);

        };

        hideScoreEditor();
        document.addEventListener('DOMContentLoaded', hideScoreEditor, { once: true });

        const styleId = 'mriia-compact-journal-style';

        function applyCompactGrades() {

            if (!document.body) {

                return;

            }

            const isJournalPage =
                location.pathname === '/Diary' ||
                location.pathname === '/SchoolDiaryPresence/Lesson';

            document.body.classList.toggle(
                'mriia-compact-journal',
                isJournalPage
            );

            if (!isJournalPage) {

                return;

            }

            initMriiaButtons();
            initMriiaDateButtons();

            if (!document.getElementById(styleId)) {

                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    #mriia-student-panel {
                        position: fixed;
                        right: 82px;
                        bottom: 20px;
                        z-index: 2147483646;
                        width: min(320px, calc(100vw - 112px));
                        max-height: min(380px, 60vh);
                        overflow: auto;
                        padding: 12px 14px;
                        border: 1px solid rgba(30, 55, 80, .14);
                        border-radius: 6px;
                        background: rgba(255, 255, 255, .86);
                        color: #243247;
                        box-shadow: 0 2px 10px rgba(20, 35, 50, .16);
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                        font: 14px/1.45 sans-serif;
                        pointer-events: none;
                    }
                    #mriia-student-panel-content.mriia-message-preview {
                        font-weight: 600;
                    }
                    .mriia-compact-journal .mriia-date-actions {
                        position: relative;
                        z-index: 3;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 1px;
                        height: 44px;
                        margin: 0 auto;
                    }
                    .mriia-compact-journal .mriia-date-column-button {
                        display: inline-flex;
                        flex: 0 0 14px;
                        width: 22px;
                        height: 14px;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        padding: 0;
                        border: 0;
                        border-radius: 3px;
                        background: #2780d9;
                        color: #fff;
                        cursor: pointer;
                        font: 600 12px/14px sans-serif;
                    }
                    .mriia-compact-journal .mriia-bulk-grade-button {
                        display: inline-flex;
                        flex: 0 0 14px;
                        width: 34px;
                        height: 14px;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        padding: 0;
                        border: 0;
                        border-radius: 3px;
                        background: #2780d9;
                        color: #fff;
                        cursor: pointer;
                        font: 600 9px/14px sans-serif;
                    }
                    .mriia-compact-journal .mriia-random-grade-button {
                        display: inline-flex;
                        flex: 0 0 14px;
                        width: 34px;
                        height: 14px;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        padding: 0;
                        border: 0;
                        border-radius: 3px;
                        background: #c8e6c9;
                        color: #256029;
                        cursor: pointer;
                        font: 600 11px/14px sans-serif;
                    }
                    .mriia-compact-journal .mriia-random-grade-button:hover {
                        background: #a5d6a7;
                    }
                    #mriia-bulk-grade-picker,
                    #mriia-random-grade-picker {
                        position: fixed;
                        z-index: 2147483647;
                        display: flex;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 6px;
                        max-width: calc(100vw - 16px);
                        padding: 8px;
                        border: 1px solid rgba(30, 55, 80, .2);
                        border-radius: 4px;
                        background: #fff;
                        box-shadow: 0 3px 12px rgba(20, 35, 50, .2);
                    }
                    #mriia-bulk-grade-picker select,
                    #mriia-bulk-grade-picker button,
                    #mriia-random-grade-picker select,
                    #mriia-random-grade-picker button {
                        height: 30px;
                        padding: 0 8px;
                        border: 1px solid #aab7c4;
                        border-radius: 3px;
                        background: #fff;
                        color: #243247;
                        font: 14px sans-serif;
                    }
                    #mriia-random-grade-picker span {
                        align-self: center;
                        color: #526273;
                        font: 12px sans-serif;
                    }
                    #mriia-random-grade-picker .mriia-random-grade-control {
                        display: flex;
                        flex: 1 1 132px;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 4px;
                        color: #243247;
                    }
                    #mriia-random-grade-picker .mriia-random-grade-control > span {
                        align-self: flex-start;
                    }
                    #mriia-random-grade-picker .mriia-random-grade-weight-control {
                        display: flex;
                    }
                    #mriia-random-grade-picker .mriia-random-grade-weights {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 3px;
                    }
                    #mriia-random-grade-picker .mriia-random-grade-weights label {
                        display: inline-flex;
                        align-items: center;
                    }
                    #mriia-random-grade-picker .mriia-random-grade-weights input {
                        width: 14px;
                        height: 14px;
                        margin: 0 2px;
                        cursor: pointer;
                    }
                    #mriia-bulk-grade-picker button,
                    #mriia-random-grade-picker button {
                        border-color: #1769aa;
                        background: #2780d9;
                        color: #fff;
                        cursor: pointer;
                    }
                    .mriia-compact-journal .table-schedule tr.mriia-date-row {
                        height: 70px !important;
                    }
                    .mriia-compact-journal .table-schedule th.mriia-date-header {
                        position: sticky !important;
                        top: 0 !important;
                        height: 70px !important;
                        min-height: 70px !important;
                        padding: 2px 0 !important;
                        vertical-align: bottom !important;
                    }
                    .mriia-compact-journal .table-schedule th.mriia-date-header::after {
                        top: auto !important;
                        right: 3px !important;
                        bottom: 3px !important;
                        left: auto !important;
                        margin: 0 !important;
                        transform: none !important;
                        z-index: 1;
                    }
                    .mriia-compact-journal .table-schedule th.mriia-date-header > div:not(.table-eps-icon) {
                        position: relative;
                        z-index: 2;
                    }
                    .mriia-compact-journal .table-schedule th.mriia-date-header > .mriia-date-column-button {
                        position: relative;
                        z-index: 2;
                    }
                    .mriia-compact-journal .table-schedule th.mriia-date-header > .mriia-date-column-button {
                        margin-bottom: 0;
                    }
                    .mriia-compact-journal .table-schedule tr:nth-child(2) > th {
                        top: 70px !important;
                    }
                    .mriia-compact-journal .mriia-date-column-button:hover,
                    .mriia-compact-journal .mriia-date-column-button.is-selected {
                        background: #145da8;
                    }
                    .mriia-compact-journal .mriia-selected-student {
                        background-color: #dcecff !important;
                    }
                    .mriia-compact-journal .table-schedule tbody tr {
                        height: 28px !important;
                    }
                    .mriia-compact-journal .table-schedule tbody tr > td {
                        height: 28px !important;
                        padding-block: 0 !important;
                    }
                    .mriia-compact-journal .table-schedule .pupil {
                        display: flex !important;
                        align-items: center !important;
                        height: 28px !important;
                        min-height: 0 !important;
                    }
                    .mriia-compact-journal .table-schedule .pupil-info {
                        display: none !important;
                    }
                    .mriia-compact-journal .table-schedule .table-user {
                        line-height: 16px !important;
                    }
                `;

                (document.head || document.documentElement).appendChild(style);

            }

            document
                .querySelectorAll('.table-schedule .pupil .table-user')
                .forEach(nameElement => {

                    if (!nameElement.dataset.mriiaFullName) {

                        nameElement.dataset.mriiaFullName =
                            nameElement.textContent.trim();

                    }

                    const nameParts = nameElement.textContent
                        .trim()
                        .split(/\s+/);

                    if (nameParts.length > 2) {

                        nameElement.textContent =
                            `${nameParts[0]} ${nameParts[1]}`;

                    }

                });

            document
                .querySelectorAll('.table-schedule .pupil .table-user')
                .forEach(nameElement => {

                    const cell = nameElement.closest('td');
                    const name = nameElement.textContent.trim();

                    if (cell && name) {

                        cell.classList.toggle(
                            'mriia-selected-student',
                            selectedMriiaStudents.has(name)
                        );

                    }

                });

        }

        const start = () => {

            startClassroomWhatsAppMonitor();
            applyCompactGrades();

            document.addEventListener('click', event => {

                const nameElement =
                    event.target.closest?.(
                        '.table-schedule .pupil .table-user'
                    );

                if (!nameElement) {

                    return;

                }

                event.preventDefault();
                event.stopPropagation();

                const name = nameElement.textContent.trim();
                const cell = nameElement.closest('td');

                if (!name || !cell) {

                    return;

                }

                copyToClipboard(name).catch(error => {

                    log('Не вдалося скопіювати ім’я:', error);

                });

                if (selectedMriiaStudents.has(name)) {

                    selectedMriiaStudents.delete(name);
                    cell.classList.remove('mriia-selected-student');

                } else {

                    selectedMriiaStudents.set(name, name);
                    cell.classList.add('mriia-selected-student');

                }

                renderMriiaPanel();

            }, true);

            if (document.body) {

                new MutationObserver(applyCompactGrades).observe(
                    document.body,
                    {
                        childList: true,
                        subtree: true,
                    }
                );

            }

        };

        if (document.readyState === 'loading') {

            document.addEventListener('DOMContentLoaded', start, { once: true });

        } else {

            start();

        }

    }


    // ============================================================
    // ЗАПУСК
    // ============================================================

    if (
        location.hostname === 'school.mriia.gov.ua' &&
        window !== window.top &&
        new URLSearchParams(location.search).get('mriiaCompletionScan') === '1'
    ) {

        return;

    }

    if (
        location.hostname ===
        'classroom.google.com'
    ) {


        startClassroom();


    } else if (
        location.hostname ===
        'web.whatsapp.com'
    ) {


        startWhatsApp();


    } else if (
        location.hostname ===
        'school.mriia.gov.ua'
    ) {


        startMriiaGradesDisplay();
        startMriiaCompletionDisplay();
    }


})();
