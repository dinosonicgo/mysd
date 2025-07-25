(function() {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = '正在獲取最新的服務網址...';
    }

    // 再次使用時間戳強制獲取最新的 config.json
    const configUrl = './config.json?cache_bust=' + new Date().getTime();

    fetch(configUrl, { cache: "no-store" })
        .then(response => {
            if (!response.ok) {
                throw new Error(`伺服器回應錯誤 (HTTP ${response.status})，請確認 GitHub Pages 是否已成功部署。`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.url) {
                if (statusEl) {
                    statusEl.textContent = '獲取成功！正在跳轉...';
                }
                window.location.href = data.url;
            } else {
                throw new Error('設定檔 (config.json) 格式不正確或缺少 URL。');
            }
        })
        .catch(error => {
            console.error('重新導向時發生錯誤:', error);
            if (statusEl) {
                statusEl.textContent = '自動重新導向失敗！請檢查啟動腳本的輸出視窗。';
            }
        });
})();