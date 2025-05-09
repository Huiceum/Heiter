class GoogleInteractionHandler {
    constructor(userTextInputEl, editorTextareaEl, loadingOverlayEl, showLoadingFn, hideLoadingFn) {
        this.userTextInput = userTextInputEl;
        this.editorTextarea = editorTextareaEl;
        this.loadingOverlay = loadingOverlayEl; // 用於更新輪詢訊息
        this.showLoading = showLoadingFn;
        this.hideLoading = hideLoadingFn;

        // Google 表單和試算表的設定
        this.GOOGLE_FORM_ID = '1FAIpQLSedI18mqcM7RKrt9dyk-PPhkhhW5nS2GG9Lxbci0AfChNjidA';
        this.GOOGLE_FORM_URL = `https://docs.google.com/forms/d/e/${this.GOOGLE_FORM_ID}/formResponse`;
        this.GOOGLE_SHEET_ID = '1W4YHC_nqWLzG4WC9rLr92TWpbMkOa3mVPkGPY8E5yVw';
        this.GOOGLE_SHEET_URL_BASE = `https://docs.google.com/spreadsheets/d/${this.GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv`;
    }

    generateRandomString(len) {
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let r = '';
        for (let i = 0; i < len; i++) r += c.charAt(Math.floor(Math.random() * c.length));
        return r;
    }

    parseComplexCsv(csvStr) {
        const rows = [];
        let cR = [], cF = '', iQF = false;
        csvStr = csvStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        for (let i = 0; i < csvStr.length; i++) {
            const ch = csvStr[i];
            if (iQF) {
                if (ch === '"') {
                    if (i + 1 < csvStr.length && csvStr[i + 1] === '"') { cF += '"'; i++; }
                    else { iQF = false; }
                } else { cF += ch; }
            } else {
                if (ch === '"' && cF === '') { iQF = true; }
                else if (ch === ',') { cR.push(cF); cF = ''; }
                else if (ch === '\n') { cR.push(cF); rows.push(cR); cR = []; cF = ''; }
                else { cF += ch; }
            }
        }
        cR.push(cF); rows.push(cR);
        return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
    }

    async submitToGoogleForm(txt, code) {
        const fd = new FormData();
        fd.append('entry.1067260806', txt);
        fd.append('entry.1456608144', code);
        try {
            await fetch(this.GOOGLE_FORM_URL, { method: 'POST', mode: 'no-cors', body: fd });
            console.log('Form submission initiated for:', code);
            return true;
        } catch (e) {
            console.error('Error submitting to Google Form:', e);
            alert('提交到Google表單時發生錯誤: ' + e.message);
            return false;
        }
    }

    async pollForResult(code) {
        const urlBase = this.GOOGLE_SHEET_URL_BASE;
        let attempts = 0, maxAttempts = 60; // 你可以調整最大嘗試次數
        return new Promise((resolve, reject) => {
            const intId = setInterval(async () => {
                attempts++;
                if (attempts > maxAttempts) {
                    clearInterval(intId);
                    reject(new Error('輪詢超時'));
                    return;
                }
                const resultUrl = `${urlBase}&r=${Date.now()}`; // 添加時間戳以避免快取
                console.log(`Polling attempt ${attempts} for ${code}...`);
                try {
                    const resp = await fetch(resultUrl);
                    if (!resp.ok) {
                        console.error('Poll network error:', resp.statusText, resp.status);
                        if (resp.status === 404 || resp.status === 403) { // 403 可能表示試算表未公開
                            clearInterval(intId);
                            reject(new Error(`輪詢失敗 (狀態 ${resp.status})`));
                        }
                        return; // 其他網路錯誤，繼續嘗試
                    }
                    const csv = await resp.text();
                    if (!csv?.trim()) {
                        console.log("Poll: empty CSV.");
                        return; // 空回應，繼續輪詢
                    }
                    const rows = this.parseComplexCsv(csv); // 使用類別方法
                    for (let rIdx = 1; rIdx < rows.length; rIdx++) { // 從 1 開始跳過表頭
                        const fields = rows[rIdx];
                        // 假設 Code 在第3欄 (索引 2)，FTDL 在第4欄 (索引 3)
                        if (fields.length > 2 && fields[2] === code) {
                            if (fields.length > 3 && fields[3] !== undefined) {
                                const ftdlOut = fields[3];
                                if (ftdlOut.trim() !== '' || ftdlOut === '') { // FTDL 欄位有內容或明確為空字串
                                    clearInterval(intId);
                                    console.log('Result for ' + code + ':', ftdlOut);
                                    // 清理潛在的 markdown 程式碼區塊
                                    let finalFtdl = ftdlOut;
                                    if (finalFtdl.startsWith("```ftdl\n")) {
                                        finalFtdl = finalFtdl.substring(8);
                                        if (finalFtdl.endsWith("\n```")) finalFtdl = finalFtdl.substring(0, finalFtdl.length - 4);
                                        else if (finalFtdl.endsWith("```")) finalFtdl = finalFtdl.substring(0, finalFtdl.length - 3);
                                    } else if (finalFtdl.startsWith("```") && finalFtdl.includes("\n")) {
                                        finalFtdl = finalFtdl.substring(finalFtdl.indexOf("\n") + 1);
                                        if (finalFtdl.endsWith("\n```")) finalFtdl = finalFtdl.substring(0, finalFtdl.length - 4);
                                        else if (finalFtdl.endsWith("```")) finalFtdl = finalFtdl.substring(0, finalFtdl.length - 3);
                                    }
                                    resolve(finalFtdl);
                                    return;
                                }
                            }
                            console.log(`Code ${code} found, FTDL col empty. Polling.`);
                            break; // 找到代碼，此輪詢不需再檢查其他行
                        }
                    }
                    // 如果 loadingOverlay 可見，更新訊息
                    if (this.loadingOverlay && this.loadingOverlay.style.display.includes('flex')) {
                        this.loadingOverlay.textContent = `檢查結果中 (${attempts}/${maxAttempts})...`;
                    }
                } catch (e) {
                    console.error('Polling error:', e);
                    // 一般 fetch 錯誤，允許重試，不清除 interval 或 reject
                }
            }, 5000); // 每 5 秒輪詢一次
        });
    }

    // 這個方法將包含原 runDialogueBtn 的事件處理邏輯
    async handleRunDialogue() {
        const userText = this.userTextInput.value.trim();
        if (!userText) {
            alert('請輸入文本！');
            return;
        }
        this.showLoading("處理請求中...");
        const rCode = this.generateRandomString(17); // 原始碼中使用的是17
        console.log('Generated Code:', rCode);

        const submitted = await this.submitToGoogleForm(userText, rCode);
        if (submitted) {
            try {
                this.showLoading("獲取內容..."); // pollForResult 會更新輪詢進度訊息
                const resTxt = await this.pollForResult(rCode);
                this.editorTextarea.value = resTxt;
                alert('已獲取內容！點擊 "渲染家系圖" 查看。');
                this.userTextInput.value = ''; // 成功後清空輸入
            } catch (e) {
                console.error('Poll/update error:', e);
                alert('獲取結果錯誤: ' + e.message);
            }
        }
        this.hideLoading();
    }
}