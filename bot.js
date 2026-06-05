const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '8641699350:AAEgOEbEQj2YcrmOhdLx1dSvhYK-l_-VJ3U';
const CHAT_ID = '6233367788';

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '🤖 *بوت لوكس كلين شغال!* ✅\n\nChat ID: `' + msg.chat.id + '`\n\n/help - المساعدة', { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, '📊 *الأوامر:*\n/stats - إحصائيات\n/new - طلبات جديدة\n/pending - معلقة\n/orders - كل الطلبات', { parse_mode: 'Markdown' });
});

console.log('🤖 Bot started!');
