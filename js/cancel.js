/* =========================================================
   James Gaze
   cancel.js — 取消頁（信件專屬連結）

   流程
   ---------------------------------------------------------
   01. 設定
   02. 工具
   03. 讀取連結 → 查詢這一筆報名（cancelLookup）
   04. 確認畫面、最後確認（cancelConfirm）
   05. 完成畫面
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       01. 設定（只需要改這裡）
       ===================================================== */

    const API_URL =
        "https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec";

    // 「幾天內匯出」由後端依 Sheet「設定」分頁的「退款承諾天數」回傳；讀不到時才用這個預設
    const DEFAULT_REFUND_DAYS = 3;

    const POST_TIMEOUT_MS = 45000;
    const CONTACT = "jamesgaze.tw@gmail.com";

    const MSG_NO_LINK =
        "請從報名成功信、候補通知信中的「取消連結」進入這一頁。" +
        "找不到信的話，請來信，我會協助您。";

    const MSG_NETWORK =
        "網路連線不穩，沒有查到結果。請重新整理頁面再試一次；若持續發生，請以 IG 或 email 私訊告訴我要取消。";

    const MSG_GENERIC_ERROR =
        "系統暫時無法處理，請以 IG 或 email 私訊告訴我要取消，我會手動為您處理。";

    const MSG_UNCERTAIN =
        "無法確認取消是否已完成。請先檢查信箱是否收到「取消申請已受理」的信；" +
        "若沒有收到，可以再按一次「確認取消」，系統不會重複處理。";


    /* =====================================================
       02. 工具
       ===================================================== */

    const $ = (id) => document.getElementById(id);

    const loadingEl = $("cx-loading");
    const invalidEl = $("cx-invalid");
    const reviewEl = $("cx-review");
    const doneEl = $("cx-done");
    const summaryEl = $("cx-summary");
    const messageEl = $("cx-message");
    const warningEl = $("cx-warning");
    const confirmBtn = $("cx-confirm-btn");
    const rescheduleLink = $("cx-reschedule-link");
    const partialNote = $("cx-partial-note");
    const transferBtn = $("cx-transfer-btn");
    const transferPanel = $("cx-transfer");
    const transferPending = $("cx-transfer-pending");
    const transferSent = $("cx-transfer-sent");

    const params = new URLSearchParams(window.location.search);
    const regId = (params.get("r") || "").trim().slice(0, 20);
    const token = (params.get("k") || "").trim().slice(0, 64);

    let item = null;
    let busy = false;

    function refundDays(d) {
        return Number(d && d.refundDays) || DEFAULT_REFUND_DAYS;
    }


    function el(tag, className, text) {

        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== undefined) {
            node.textContent = text;
        }

        return node;

    }


    function fmtDate(iso) {
        return String(iso).replace(/-/g, "/");
    }

    function fmtMoney(n) {
        return "NT$" + Number(n).toLocaleString("en-US");
    }


    async function postJson(payload) {

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);

        try {

            // 用 text/plain，避免瀏覽器的預檢請求（Apps Script 不處理）
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload),
                signal: ctrl.signal
            });

            return await res.json();

        } finally {

            clearTimeout(timer);

        }

    }


    function show(which, text) {

        loadingEl.hidden = which !== "loading";
        invalidEl.hidden = which !== "invalid";
        reviewEl.hidden = which !== "review";
        doneEl.hidden = which !== "done";

        if (which === "invalid") {
            $("cx-invalid-text").textContent = text || MSG_GENERIC_ERROR;
        }

        // 完成後只留結果，不再顯示標題與說明
        $("cx-title").hidden = which === "done";
        $("cx-lead").hidden = which !== "review";

        const focusId = which === "review" ? "cx-review-title"
            : which === "done" ? "cx-done-title" : "";

        if (focusId) {

            const node = $(focusId);
            node.scrollIntoView({ behavior: "smooth", block: "start" });
            node.focus({ preventScroll: true });

        }

    }


    function setError(id, text) {
        $(id).textContent = text || "";
    }


    function rowEl(label, value) {

        const wrap = el("div");
        wrap.appendChild(el("dt", "", label));

        const dd = el("dd");

        if (typeof value === "string") {
            dd.textContent = value;
        } else {
            dd.appendChild(value);
        }

        wrap.appendChild(dd);
        return wrap;

    }


    /* =====================================================
       03. 讀取連結 → 查詢這一筆報名
       ===================================================== */

    async function init() {

        if (!regId || !token) {
            show("invalid", MSG_NO_LINK);
            return;
        }

        show("loading");

        let data = null;

        try {

            data = await postJson({
                action: "cancelLookup",
                regId: regId,
                token: token
            });

        } catch (err) {

            console.error("[cancel] 查詢失敗（連線或回應格式）：", err);
            show("invalid", MSG_NETWORK);
            return;

        }

        try {

            if (data && data.ok && data.already && data.done) {

                renderDone(data.done, true);

            } else if (data && data.ok && data.item) {

                item = data.item;
                renderReview();

            } else if (data && data.ok === false && data.error) {

                show("invalid", data.error);

            } else {

                console.error("[cancel] 非預期的回傳：", data);
                show("invalid", MSG_GENERIC_ERROR);

            }

        } catch (err) {

            console.error("[cancel] 畫面顯示失敗：", err, data);
            show("invalid", MSG_GENERIC_ERROR);

        }

    }


    /* =====================================================
       04. 確認畫面
       ===================================================== */

    function renderReview() {

        const it = item;

        summaryEl.textContent = "";
        setError("cx-review-error", "");

        // 可以改期的報名（報名截止前的正取、候補、未能開課的梯次）才會有改期連結
        if (it.rescheduleUrl) {
            rescheduleLink.href = it.rescheduleUrl;
            rescheduleLink.hidden = false;
        } else {
            rescheduleLink.hidden = true;
        }

        partialNote.hidden = !it.partial;
        renderTransfer();
        summaryEl.appendChild(rowEl("課程", it.courseName));
        summaryEl.appendChild(rowEl("開課日", fmtDate(it.date)));
        summaryEl.appendChild(rowEl("報名編號", it.regId));
        summaryEl.appendChild(rowEl("目前狀態", it.state));

        if (it.received > 0) {
            summaryEl.appendChild(rowEl("已付款項", fmtMoney(it.received)));
        }

        if (!it.allowed) {

            summaryEl.appendChild(rowEl("應退金額", "NT$0（不退費）"));

            messageEl.textContent = it.message;
            messageEl.hidden = false;
            warningEl.hidden = true;
            confirmBtn.hidden = true;
            show("review");
            return;

        }

        messageEl.hidden = true;
        warningEl.hidden = false;
        confirmBtn.hidden = false;

        summaryEl.appendChild(rowEl("適用規則", it.rule));
        summaryEl.appendChild(rowEl("應退金額", el("span", "cx-amount", fmtMoney(it.amount))));

        if (it.amount > 0) {

            summaryEl.appendChild(
                rowEl("退回帳戶", "報名時填寫的帳戶（末四碼 " + it.last4 + "）")
            );

            summaryEl.appendChild(
                rowEl("退款時間", "取消後 " + refundDays(it) + " 天內匯出")
            );

            confirmBtn.textContent = "確認取消，退款 " + fmtMoney(it.amount);

        } else {

            confirmBtn.textContent = "確認取消";

        }

        show("review");

    }


    confirmBtn.addEventListener("click", async () => {

        if (busy || !item) {
            return;
        }

        busy = true;
        confirmBtn.disabled = true;

        const label = confirmBtn.textContent;
        confirmBtn.textContent = "處理中…";
        setError("cx-review-error", "");

        try {

            const data = await postJson({
                action: "cancelConfirm",
                regId: regId,
                token: token,
                expectedAmount: item.amount
            });

            if (data && data.ok) {

                renderDone(data, !!data.already);

            } else if (data && data.changed) {

                // 按下確認的瞬間跨過了截止時間：金額變了，請學員重新確認
                item.amount = Number(data.amount) || 0;
                item.rule = data.rule || item.rule;
                renderReview();
                setError("cx-review-error",
                    "退費金額已更新為 " + fmtMoney(item.amount) +
                    "，請確認後再按一次。");

            } else if (data && data.ok === false && data.error) {

                setError("cx-review-error", data.error);
                confirmBtn.textContent = label;

            } else {

                console.error("[cancel] 非預期的回傳：", data);
                setError("cx-review-error", MSG_UNCERTAIN);
                confirmBtn.textContent = label;

            }

        } catch (err) {

            console.error("[cancel] 確認失敗：", err);
            setError("cx-review-error", MSG_UNCERTAIN);
            confirmBtn.textContent = label;

        } finally {

            busy = false;
            confirmBtn.disabled = false;

        }

    });


    /* =====================================================
       04-2. 轉讓名額
       ===================================================== */

    function showPending(masked) {

        if (masked) {

            transferPending.textContent =
                "您目前有一筆轉讓邀請（寄給 " + masked +
                "）進行中。若您取消報名，這筆邀請會作廢。";
            transferPending.hidden = false;

        } else {

            transferPending.hidden = true;

        }

    }


    function renderTransfer() {

        const t = (item && item.transfer) || {};

        transferPanel.hidden = true;
        transferSent.hidden = true;
        transferBtn.hidden = !t.available;
        transferBtn.setAttribute("aria-expanded", "false");

        $("cx-transfer-deadline").textContent = t.deadlineText || "";
        $("cx-tf-email").value = "";
        $("cx-tf-email2").value = "";
        $("cx-tf-settle").checked = false;
        setError("cx-tf-error", "");

        showPending(t.pendingEmail);

    }


    transferBtn.addEventListener("click", () => {

        const open = transferPanel.hidden;

        transferPanel.hidden = !open;
        transferBtn.setAttribute("aria-expanded", String(open));

        if (open) {
            $("cx-tf-email").focus();
        }

    });


    $("cx-tf-send").addEventListener("click", async () => {

        if (busy || !item) {
            return;
        }

        const email = $("cx-tf-email").value.trim().toLowerCase();
        const email2 = $("cx-tf-email2").value.trim().toLowerCase();

        setError("cx-tf-error", "");

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("cx-tf-error", "請填寫正確的電子郵件。");
            return;
        }

        if (email !== email2) {
            setError("cx-tf-error", "兩次輸入的電子郵件不一致，請再確認。");
            return;
        }

        if (!$("cx-tf-settle").checked) {
            setError("cx-tf-error", "請勾選同意自行與受讓人結算。");
            return;
        }

        busy = true;

        const sendBtn = $("cx-tf-send");
        const label = sendBtn.textContent;

        sendBtn.disabled = true;
        sendBtn.textContent = "處理中…";

        try {

            const data = await postJson({
                action: "transferStart",
                regId: regId,
                token: token,
                email: email,
                settleOk: true
            });

            if (data && data.ok) {

                item.transfer = item.transfer || {};
                item.transfer.pendingEmail = data.emailMasked || "";

                transferPanel.hidden = true;
                transferBtn.setAttribute("aria-expanded", "false");

                transferSent.textContent =
                    "已寄邀請到 " + (data.emailMasked || "受讓人的信箱") +
                    "。受讓人完成前，名額仍屬於您；您也可以隨時改為取消報名。";
                transferSent.hidden = false;

                showPending(item.transfer.pendingEmail);

            } else if (data && data.ok === false && data.error) {

                setError("cx-tf-error", data.error);

            } else {

                console.error("[cancel] 非預期的回傳：", data);
                setError("cx-tf-error", MSG_GENERIC_ERROR);

            }

        } catch (err) {

            console.error("[cancel] 轉讓邀請失敗：", err);
            setError("cx-tf-error", MSG_GENERIC_ERROR);

        } finally {

            busy = false;
            sendBtn.disabled = false;
            sendBtn.textContent = label;

        }

    });
    

    /* =====================================================
       05. 完成畫面
       ===================================================== */

    function renderDone(d, already) {

        const sum = $("cx-done-summary");
        const notes = $("cx-done-notes");

        sum.textContent = "";
        notes.textContent = "";

        sum.appendChild(rowEl("報名編號", d.regId));
        sum.appendChild(rowEl("課程", d.courseName));
        sum.appendChild(rowEl("開課日", fmtDate(d.date)));

        const amt = Number(d.amount) || 0;

        sum.appendChild(rowEl("應退金額", fmtMoney(amt)));

        if (amt > 0) {

            sum.appendChild(
                rowEl("退回帳戶", "報名時填寫的帳戶（末四碼 " + (d.last4 || "") + "）")
            );

            notes.appendChild(el("li", "", d.refunded
                ? "退款已經匯出，詳情請見我寄給您的退款完成信。"
                : "我會在 " + refundDays(d) + " 天內把款項匯出，匯出後會再寄信通知您。"));

        } else {

            notes.appendChild(el("li", "", "這次沒有需要退款的款項。"));

        }

        if (already) {

            notes.appendChild(el("li", "",
                "這筆報名先前已經完成取消，系統沒有重複處理。"));

        } else if (d.emailSent === false) {

            notes.appendChild(el("li", "",
                "確認信暫時沒有寄出。請截圖保存這一頁，我會盡快與您聯繫。"));

        } else {

            notes.appendChild(el("li", "",
                "取消確認信已寄到您的信箱。若沒收到，請查看垃圾信件匣。"));

        }

        notes.appendChild(el("li", "",
            "有任何問題，請來信 " + CONTACT + "。"));

        show("done");

    }


    /* ===================================================== */

    init();

})();
