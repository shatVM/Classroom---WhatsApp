# Classroom → WhatsApp

Userscript для Google Classroom, WhatsApp Web і Мрія.

## Встановлення на кожному пристрої

1. Встановіть Tampermonkey у Chrome.
2. Відкрийте [посилання для встановлення скрипта](https://raw.githubusercontent.com/shatVM/Classroom---WhatsApp/main/script.js).
3. Підтвердьте встановлення в Tampermonkey.

Скрипт потрібно встановити окремо на кожному пристрої. Tampermonkey перевіряє
оновлення за постійною адресою GitHub; локальний Node.js сервер не потрібен.

## Публікація оновлення

Змініть `script.js`, збільште значення і в метаданих `@version`, і в
`SCRIPT_VERSION`, а потім збережіть зміни в гілку `main` GitHub. Tampermonkey
завантажить нову версію під час наступної перевірки оновлень. Перевірку також
можна запустити вручну з панелі Tampermonkey.

Репозиторій публічний, тому вихідний код скрипта доступний усім.
