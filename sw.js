// static/js/sw.js

// 函式功能：監聽 'push' 事件，當從伺服器接收到推播訊息時觸發
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received.');
    
    // 解析從伺服器傳來的 JSON 數據
    // 如果解析失敗，則使用預設的標題和訊息
    let notificationData = {};
    try {
        notificationData = event.data.json();
    } catch (e) {
        console.error('Failed to parse push notification data:', e);
        notificationData = {
            title: '收到新通知',
            body: '您有一條新訊息。',
        };
    }

    const title = notificationData.title || '新通知';
    const options = {
        body: notificationData.body || '您有一條新訊息。',
        // 您可以指定一個圖示，將其放在 static/images/icon.png
        // icon: '/static/images/icon-192x192.png', 
        // badge: '/static/images/badge-72x72.png' // 用於 Android 通知欄的小圖示
    };

    // 使用 event.waitUntil 確保 Service Worker 在通知顯示前不會被終止
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});
// 函式功能：監聽 'push' 事件，當從伺服器接收到推播訊息時觸發

// 函式功能：監聽 'notificationclick' 事件，當使用者點擊通知時觸發
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.');

    // 關閉通知
    event.notification.close();

    // [v1.1 修正] 將目標 URL 從固定的 '/' 改為使用 Service Worker 的 scope，以適應子目錄部署
    const targetUrl = self.registration.scope;

    // 聚焦到已開啟的應用程式視窗，如果沒有則開啟一個新的
    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true // 確保能找到所有相關的客戶端
        }).then(clientList => {
            // 尋找是否已有匹配 scope 的視窗開啟
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                // 檢查 URL 是否與 scope 匹配
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // 如果沒有找到已開啟的視窗，則開啟一個新的
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
// 函式功能：監聽 'notificationclick' 事件，當使用者點擊通知時觸發