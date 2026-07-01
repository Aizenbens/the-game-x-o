const express = require('express');
const path = require('path');
const app = express();

// تخديم ملفات الواجهة من المجلد الحالي تلقائياً
app.use(express.static(__dirname));

// تحويل أي طلب مباشرة إلى ملف index.html الرئيسي
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// تشغيل السيرفر على المنفذ الديناميكي الخاص بالمنصة
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر المستقل يعمل بنجاح على بورت: ${PORT}`);
});
