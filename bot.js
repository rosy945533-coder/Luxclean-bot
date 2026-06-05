const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '8641699350:AAEgOEbEQj2YcrmOhdLx1dSvhYK-l_-VJ3U';
const CHAT_ID = '6233367788';

const bot = new TelegramBot(TOKEN, { polling: true });

const STATUS_NAMES = {
    'new': '🆕 جديد',
    'accepted': '✅ مقبول',
    'rejected': '❌ مرفوض',
    'pending': '⏳ معلق',
    'called': '📞 تم الاتصال',
    'shipped': '🚚 تم التوصيل',
    'paid': '💰 تم الدفع'
};

// ==================== أوامر ====================
bot.onText(/\/start/, (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) {
        return bot.sendMessage(msg.chat.id, '⛔ هذا البوت خاص بالإدارة');
    }
    bot.sendMessage(msg.chat.id, 
        '🤖 *بوت لوكس كلين*\n\n' +
        '📊 *الأوامر:*\n' +
        '/stats - إحصائيات\n' +
        '/new - طلبات جديدة\n' +
        '/pending - معلقة\n' +
        '/orders - كل الطلبات\n' +
        '/today - طلبات اليوم', 
        { parse_mode: 'Markdown' }
    );
});

// ==================== إحصائيات ====================
bot.onText(/\/stats/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    try {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/luxclean-a6c1f/databases/(default)/documents/orders?key=AIzaSyBr0A1nLUAfAPjSTkpDGJgIVewzr4x7c0w');
        const data = await response.json();
        
        let stats = { total: 0, news: 0, accepted: 0, pending: 0, rejected: 0, revenue: 0 };
        
        if (data.documents) {
            data.documents.forEach(doc => {
                const f = doc.fields || {};
                stats.total++;
                const status = f.status?.stringValue || 'new';
                if (status === 'new') stats.news++;
                if (status === 'accepted') stats.accepted++;
                if (status === 'pending') stats.pending++;
                if (status === 'rejected') stats.rejected++;
                stats.revenue += Number(f.total?.doubleValue || f.total?.integerValue || 0);
            });
        }
        
        bot.sendMessage(msg.chat.id,
            '📊 *إحصائيات لوكس كلين*\n\n' +
            '📦 الإجمالي: ' + stats.total + '\n' +
            '🆕 جديد: ' + stats.news + '\n' +
            '✅ مقبول: ' + stats.accepted + '\n' +
            '⏳ معلق: ' + stats.pending + '\n' +
            '❌ مرفوض: ' + stats.rejected + '\n' +
            '💰 الإيرادات: ' + stats.revenue + ' ر.ي',
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ خطأ في جلب الإحصائيات');
    }
});

// ==================== طلبات جديدة ====================
bot.onText(/\/new/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrders(msg.chat.id, 'new', '🆕 طلبات جديدة');
});

bot.onText(/\/pending/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrders(msg.chat.id, 'pending', '⏳ طلبات معلقة');
});

bot.onText(/\/(orders|today)/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrders(msg.chat.id, null, '📊 جميع الطلبات');
});

async function getOrders(chatId, status, title) {
    try {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/luxclean-a6c1f/databases/(default)/documents/orders?key=AIzaSyBr0A1nLUAfAPjSTkpDGJgIVewzr4x7c0w');
        const data = await response.json();
        
        let orders = [];
        if (data.documents) {
            data.documents.forEach(doc => {
                const f = doc.fields || {};
                const orderStatus = f.status?.stringValue || 'new';
                if (!status || orderStatus === status) {
                    orders.push({
                        id: doc.name.split('/').pop(),
                        name: f.customerName?.stringValue || 'بدون اسم',
                        phone: f.phone?.stringValue || '',
                        city: f.city?.stringValue || '',
                        total: Number(f.total?.doubleValue || f.total?.integerValue || 0),
                        status: orderStatus,
                        items: f.items?.arrayValue?.values || []
                    });
                }
            });
        }
        
        if (orders.length === 0) {
            return bot.sendMessage(chatId, '📭 لا توجد طلبات ' + title);
        }
        
        let text = '*📊 ' + title + '* (' + orders.length + ')\n\n';
        orders.slice(0, 15).forEach((o, i) => {
            const itemsCount = o.items.length;
            text += (i+1) + '. ' + o.name + ' - ' + o.total + ' ر.ي - ' + (o.city || 'غير محدد') + ' [' + itemsCount + ' منتج]\n';
        });
        
        if (orders.length > 15) text += '\n... و ' + (orders.length - 15) + ' طلبات أخرى';
        
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, '❌ خطأ في جلب الطلبات');
    }
}

// ==================== أزرار تفاعلية ====================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (chatId.toString() !== CHAT_ID) {
        return bot.answerCallbackQuery(query.id, { text: '⛔ غير مصرح' });
    }
    
    const [action, orderId] = query.data.split('_');
    const statusMap = {
        'accept': 'accepted',
        'reject': 'rejected',
        'pending': 'pending',
        'called': 'called',
        'reopen': 'new'
    };
    
    const newStatus = statusMap[action] || action;
    
    try {
        // تحديث الحالة في Firebase
        await fetch('https://firestore.googleapis.com/v1/projects/luxclean-a6c1f/databases/(default)/documents/orders/' + orderId + '?updateMask.fieldPaths=status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { status: { stringValue: newStatus } } })
        });
        
        bot.answerCallbackQuery(query.id, { text: '✅ تم: ' + STATUS_NAMES[newStatus], show_alert: true });
        bot.sendMessage(chatId, '✅ طلب #' + orderId.slice(-4) + ' → ' + STATUS_NAMES[newStatus]);
    } catch (e) {
        bot.answerCallbackQuery(query.id, { text: '❌ خطأ', show_alert: true });
    }
});

console.log('🤖 LuxClean Bot is running!');
