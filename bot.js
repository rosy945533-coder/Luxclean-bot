const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '8641699350:AAEgOEbEQj2YcrmOhdLx1dSvhYK-l_-VJ3U';
const CHAT_ID = '6233367788';

const bot = new TelegramBot(TOKEN, { polling: true });
const API = 'https://firestore.googleapis.com/v1/projects/luxclean-a6c1f/databases/(default)/documents';
const KEY = 'AIzaSyBr0A1nLUAfAPjSTkpDGJgIVewzr4x7c0w';

const STATUS = {
    'new': '🆕 جديد', 'accepted': '✅ مقبول', 'rejected': '❌ مرفوض',
    'pending': '⏳ معلق', 'called': '📞 تم الاتصال', 'shipped': '🚚 تم التوصيل',
    'paid': '💰 تم الدفع', 'cancelled': '🚫 ملغي'
};

// ==================== القائمة ====================
bot.onText(/\/start/, (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return bot.sendMessage(msg.chat.id, '⛔ خاص بالإدارة');
    bot.sendMessage(msg.chat.id, 
        '🤖 *بوت لوكس كلين - نظام محاسبي*\n\n' +
        '📊 *إحصائيات:* /stats\n' +
        '📅 *يومي:* /today\n' +
        '📆 *أسبوعي:* /week\n' +
        '📅 *شهري:* /month\n\n' +
        '📋 *طلبات:* /new | /pending | /accepted | /orders\n\n' +
        '🔍 *بحث:* /order رقم | /search اسم | /phone رقم\n\n' +
        '📊 *تقارير:* /report | /export\n' +
        '📦 *منتجات:* /products\n\n' +
        '⏰ *بوقت محدد:* /from 2026-06-01 /to 2026-06-05',
        { parse_mode: 'Markdown' }
    );
});

// ==================== إحصائيات كاملة ====================
bot.onText(/\/stats/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const orders = await getAllOrders();
    
    let stats = { total: 0, news: 0, accepted: 0, pending: 0, rejected: 0, called: 0, shipped: 0, paid: 0, cancelled: 0, revenue: 0, paidRevenue: 0 };
    
    orders.forEach(o => {
        stats.total++;
        stats[o.status] = (stats[o.status] || 0) + 1;
        stats.revenue += o.total || 0;
        if (o.status === 'paid' || o.status === 'shipped') stats.paidRevenue += o.total || 0;
    });
    
    const conversionRate = stats.total > 0 ? ((stats.accepted + stats.paid + stats.shipped) / stats.total * 100).toFixed(1) : 0;
    
    bot.sendMessage(msg.chat.id,
        '📊 *إحصائيات لوكس كلين*\n\n' +
        '📦 إجمالي الطلبات: ' + stats.total + '\n\n' +
        '🆕 جديد: ' + stats.news + ' | ⏳ معلق: ' + stats.pending + '\n' +
        '📞 تم الاتصال: ' + stats.called + ' | ✅ مقبول: ' + stats.accepted + '\n' +
        '🚚 تم التوصيل: ' + stats.shipped + ' | 💰 مدفوع: ' + stats.paid + '\n' +
        '❌ مرفوض: ' + stats.rejected + ' | 🚫 ملغي: ' + stats.cancelled + '\n\n' +
        '💰 الإيرادات الكلية: *' + stats.revenue + ' ر.ي*\n' +
        '💵 المحصل: *' + stats.paidRevenue + ' ر.ي*\n' +
        '📊 نسبة النجاح: *' + conversionRate + '%*',
        { parse_mode: 'Markdown' }
    );
});

// ==================== اليوم ====================
bot.onText(/\/today/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByDate(msg.chat.id, 'today', '📅 ملخص اليوم');
});

// ==================== الأسبوع ====================
bot.onText(/\/week/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByDate(msg.chat.id, 'week', '📆 ملخص الأسبوع');
});

// ==================== الشهر ====================
bot.onText(/\/month/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByDate(msg.chat.id, 'month', '📅 ملخص الشهر');
});

// ==================== دالة التاريخ الموحدة ====================
async function getOrdersByDate(chatId, period, title) {
    const orders = await getAllOrders();
    const now = new Date();
    
    let startDate;
    if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
        const day = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const filtered = orders.filter(o => {
        if (!o.createdAt) return false;
        return new Date(o.createdAt) >= startDate;
    });
    
    if (filtered.length === 0) return bot.sendMessage(chatId, '📭 لا توجد طلبات في هذه الفترة');
    
    let revenue = 0, paidRevenue = 0;
    filtered.forEach(o => {
        revenue += o.total || 0;
        if (o.status === 'paid' || o.status === 'shipped') paidRevenue += o.total || 0;
    });
    
    // تجميع حسب الحالة
    let statusCount = {};
    filtered.forEach(o => statusCount[o.status] = (statusCount[o.status] || 0) + 1);
    
    let text = '*📊 ' + title + '*\n' +
        '📅 من: ' + startDate.toLocaleDateString('ar-SA') + '\n' +
        '📅 إلى: ' + now.toLocaleDateString('ar-SA') + '\n\n' +
        '📦 عدد الطلبات: *' + filtered.length + '*\n' +
        '💰 الإيرادات: *' + revenue + ' ر.ي*\n' +
        '💵 المحصل: *' + paidRevenue + ' ر.ي*\n\n';
    
    // الحالات
    Object.entries(statusCount).forEach(([status, count]) => {
        text += STATUS[status] + ': ' + count + '\n';
    });
    
    text += '\n📋 *آخر 10 طلبات:*\n';
    filtered.slice(-10).reverse().forEach((o, i) => {
        const time = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
        text += (i+1) + '. ' + o.customerName + ' - ' + o.total + ' ر.ي - ' + STATUS[o.status] + ' - ' + time + '\n';
    });
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// ==================== طلبات جديدة ====================
bot.onText(/\/new/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByStatus(msg.chat.id, 'new', '🆕 طلبات جديدة');
});

bot.onText(/\/pending/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByStatus(msg.chat.id, 'pending', '⏳ طلبات معلقة');
});

bot.onText(/\/accepted/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByStatus(msg.chat.id, 'accepted', '✅ طلبات مقبولة');
});

bot.onText(/\/orders/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    await getOrdersByStatus(msg.chat.id, null, '📋 جميع الطلبات');
});

async function getOrdersByStatus(chatId, status, title) {
    const orders = await getAllOrders();
    const filtered = status ? orders.filter(o => o.status === status) : orders;
    
    if (filtered.length === 0) return bot.sendMessage(chatId, '📭 لا توجد طلبات');
    
    let text = '*📊 ' + title + '* (' + filtered.length + ')\n\n';
    filtered.slice(0, 15).forEach((o, i) => {
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-SA') : '-';
        const time = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
        text += (i+1) + '. ' + o.customerName + ' - *' + o.total + ' ر.ي* - ' + (o.city||'?') + '\n   📅 ' + date + ' ' + time + ' | 📱 ' + o.phone + '\n\n';
    });
    
    if (filtered.length > 15) text += '... و ' + (filtered.length - 15) + ' طلبات أخرى';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// ==================== تفاصيل طلب ====================
bot.onText(/\/order (.+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const searchId = match[1].trim();
    const orders = await getAllOrders();
    const order = orders.find(o => o.id && o.id.endsWith(searchId));
    
    if (!order) return bot.sendMessage(msg.chat.id, '❌ الطلب غير موجود');
    
    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';
    const time = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    
    const items = order.items.map(i => '▸ ' + i.name + ' ×' + (i.quantity||1) + ' = *' + ((i.price||0)*(i.quantity||1)) + ' ر.ي*').join('\n');
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ قبول', callback_data: 'accept_' + order.id },
                { text: '❌ رفض', callback_data: 'reject_' + order.id }
            ],
            [
                { text: '⏳ معلق', callback_data: 'pending_' + order.id },
                { text: '📞 تم الاتصال', callback_data: 'called_' + order.id }
            ],
            [
                { text: '🚚 تم التوصيل', callback_data: 'shipped_' + order.id },
                { text: '💰 مدفوع', callback_data: 'paid_' + order.id }
            ]
        ]
    };
    
    bot.sendMessage(msg.chat.id,
        '🛒 *طلب #' + order.id.slice(-4) + '*\n\n' +
        '👤 *العميل:* ' + order.customerName + '\n' +
        '📱 *الهاتف:* +967' + order.phone + '\n' +
        '🏙️ *المحافظة:* ' + (order.city || '-') + '\n' +
        '📍 *العنوان:* ' + (order.address || '-') + '\n' +
        (order.location ? '🗺️ [الموقع](' + order.location + ')\n' : '') + '\n' +
        '📅 *التاريخ:* ' + date + '\n' +
        '🕐 *الوقت:* ' + time + '\n\n' +
        '📦 *المنتجات:*\n' + items + '\n\n' +
        '💰 *المجموع: ' + order.total + ' ر.ي*\n' +
        '📊 *الحالة:* ' + STATUS[order.status],
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
});

// ==================== بحث ====================
bot.onText(/\/search (.+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const name = match[1].trim().toLowerCase();
    const orders = await getAllOrders();
    const results = orders.filter(o => o.customerName && o.customerName.toLowerCase().includes(name));
    
    if (results.length === 0) return bot.sendMessage(msg.chat.id, '🔍 لا توجد نتائج');
    
    let text = '🔍 *نتائج: ' + name + '* (' + results.length + ')\n\n';
    let totalSpent = 0;
    results.forEach((o, i) => {
        totalSpent += o.total || 0;
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-SA') : '-';
        text += (i+1) + '. ' + o.customerName + ' - ' + o.total + ' ر.ي - ' + date + ' - ' + STATUS[o.status] + '\n';
    });
    text += '\n💰 *إجمالي مشترياته: ' + totalSpent + ' ر.ي*';
    
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/phone (.+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const phone = match[1].trim();
    const orders = await getAllOrders();
    const results = orders.filter(o => o.phone && o.phone.includes(phone));
    
    if (results.length === 0) return bot.sendMessage(msg.chat.id, '🔍 لا توجد نتائج');
    
    let totalSpent = 0;
    let text = '🔍 *طلبات الرقم: ' + phone + '* (' + results.length + ')\n\n';
    results.forEach((o, i) => {
        totalSpent += o.total || 0;
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-SA') : '-';
        text += (i+1) + '. ' + o.customerName + ' - ' + o.total + ' ر.ي - ' + date + '\n';
    });
    text += '\n💰 *إجمالي: ' + totalSpent + ' ر.ي*';
    
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ==================== تقرير ====================
bot.onText(/\/report/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const orders = await getAllOrders();
    
    let cities = {}, products = {}, hourlyStats = {};
    
    orders.forEach(o => {
        cities[o.city || 'غير محدد'] = (cities[o.city || 'غير محدد'] || 0) + 1;
        
        o.items.forEach(item => {
            products[item.name] = (products[item.name] || 0) + (item.quantity || 1);
        });
        
        if (o.createdAt) {
            const hour = new Date(o.createdAt).getHours();
            hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
        }
    });
    
    let text = '📊 *تقرير لوكس كلين*\n\n';
    
    text += '🏙️ *المحافظات:*\n';
    Object.entries(cities).sort((a,b) => b[1]-a[1]).slice(0, 5).forEach(([c, n]) => text += '• ' + c + ': ' + n + '\n');
    
    text += '\n📦 *الأكثر مبيعاً:*\n';
    Object.entries(products).sort((a,b) => b[1]-a[1]).slice(0, 5).forEach(([p, n]) => text += '• ' + p + ': ' + n + ' قطعة\n');
    
    text += '\n⏰ *أوقات الذروة:*\n';
    Object.entries(hourlyStats).sort((a,b) => b[1]-a[1]).slice(0, 3).forEach(([h, n]) => text += '• الساعة ' + h + ': ' + n + ' طلبات\n');
    
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ==================== منتجات ====================
bot.onText(/\/products/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const res = await fetch(API + '/products?key=' + KEY);
    const data = await res.json();
    if (!data.documents) return bot.sendMessage(msg.chat.id, '📭 لا توجد منتجات');
    
    let text = '📦 *المنتجات*\n\n';
    data.documents.forEach((doc, i) => {
        const f = doc.fields || {};
        text += (i+1) + '. ' + (f.name?.stringValue||'-') + ' - ' + (f.price?.doubleValue||f.price?.integerValue||0) + ' ر.ي - ' + (f.active?.booleanValue !== false ? '🟢' : '🔴') + '\n';
    });
    
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ==================== تصدير ====================
bot.onText(/\/export/, async (msg) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    const orders = await getAllOrders();
    
    let csv = 'رقم الطلب,التاريخ,الوقت,العميل,الهاتف,المحافظة,العنوان,المنتجات,الكمية,السعر,المجموع,الحالة\n';
    orders.forEach(o => {
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-SA') : '-';
        const time = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ar-SA') : '-';
        o.items.forEach(item => {
            csv += o.id.slice(-4) + ',' + date + ',' + time + ',' + o.customerName + ',' + o.phone + ',' + (o.city||'') + ',' + (o.address||'') + ',' + item.name + ',' + (item.quantity||1) + ',' + (item.price||0) + ',' + o.total + ',' + STATUS[o.status] + '\n';
        });
    });
    
    bot.sendDocument(msg.chat.id, Buffer.from(csv, 'utf-8'), {}, { filename: 'تقرير_لوكس_كلين_' + new Date().toLocaleDateString('ar-SA') + '.csv', contentType: 'text/csv' });
});

// ==================== أزرار تفاعلية ====================
bot.on('callback_query', async (query) => {
    if (query.message.chat.id.toString() !== CHAT_ID) return bot.answerCallbackQuery(query.id, { text: '⛔ غير مصرح' });
    
    const [action, orderId] = query.data.split('_');
    const statusMap = { 'accept': 'accepted', 'reject': 'rejected', 'pending': 'pending', 'called': 'called', 'shipped': 'shipped', 'paid': 'paid' };
    const newStatus = statusMap[action] || action;
    
    await fetch(API + '/orders/' + orderId + '?updateMask.fieldPaths=status&updateMask.fieldPaths=statusUpdatedAt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: { stringValue: newStatus }, statusUpdatedAt: { timestampValue: new Date().toISOString() } } })
    });
    
    bot.answerCallbackQuery(query.id, { text: '✅ ' + STATUS[newStatus], show_alert: true });
    bot.sendMessage(query.message.chat.id, '✅ طلب #' + orderId.slice(-4) + ' → ' + STATUS[newStatus] + '\n🕐 ' + new Date().toLocaleTimeString('ar-SA'));
});

// ==================== دالة مساعدة ====================
async function getAllOrders() {
    const res = await fetch(API + '/orders?key=' + KEY);
    const data = await res.json();
    const orders = [];
    if (data.documents) {
        data.documents.forEach(doc => {
            const f = doc.fields || {};
            orders.push({
                id: doc.name.split('/').pop(),
                customerName: f.customerName?.stringValue || '',
                phone: f.phone?.stringValue || '',
                city: f.city?.stringValue || '',
                address: f.address?.stringValue || '',
                location: f.location?.stringValue || '',
                total: Number(f.total?.doubleValue || f.total?.integerValue || 0),
                status: f.status?.stringValue || 'new',
                createdAt: f.createdAt?.timestampValue || null,
                items: (f.items?.arrayValue?.values || []).map(v => ({
                    name: v.mapValue?.fields?.name?.stringValue || '',
                    quantity: Number(v.mapValue?.fields?.quantity?.integerValue || 1),
                    price: Number(v.mapValue?.fields?.price?.doubleValue || v.mapValue?.fields?.price?.integerValue || 0)
                }))
            });
        });
    }
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

console.log('🤖 LuxClean Bot Running!');
