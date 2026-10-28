/* =========================================================
   James Gaze
   reschedule.js — 改期頁（信件專屬連結）

   流程
   ---------------------------------------------------------
   01. 設定
   02. 工具
   03. 讀取連結 → 查詢這一筆報名（rescheduleLookup）
   04. 確認畫面、最後確認（rescheduleConfirm）
   05. 完成畫面
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       01. 設定（只需要改這裡；與 cancel.js 相同的公開 API 網址）
       ===================================================== */

    const API_URL =
        "https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec";

    const POST_TIMEOUT_MS = 45000;
    const CONTACT = "jamesgaze.tw@gmail.com";

    const MSG_NO_LINK =
        "請從信件中的「改期連結」進入這一頁。" +
        "找不到信的話，請來信，我會協助您。";

    const MSG_NETWORK =
        "網路連線不穩，沒有查到結果。請重新整理頁面再試一次；若持續發生，請直接回覆通知信告訴我您的選擇。";

    const MSG_GENERIC_ERROR =
        "系統暫時無法處理，請直接回覆通知信告訴我您的選擇，我會手動為您處理。";

    const MSG_UNCERTAIN =
        "無法確認改期是否已完成。請先檢查信箱是否收到「改期完成」的信；" +
        "若沒有收到，可以再按一次「確認改期」，系統不會重複處理。";


    /* =====================================================
       02. 工具
       ===================================================== */

    const $ = (id) => document.getElementById(id);

    const loadingEl = $("rs-loading");
    const invalidEl = $("rs-invalid");
    const reviewEl = $("rs-review");
    const doneEl = $("rs-done");
    const summaryEl = $("rs-summary");
    const messageEl = $("rs-message");
    const warningEl = $("rs-warning");
    const warningActiveEl = $("rs-warning-active");
    const confirmBtn = $("rs-confirm-btn");
    const refundLink = $("rs-refund-link");

    const params = new URLSearchParams(window.location.search);
    const regId = (params.get("r") || "").trim().slice(0, 20);
    const token = (params.get("k") || "").trim().slice(0, 64);

    let item = null;
    let busy = false;


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
            $("rs-invalid-text").textContent = text || MSG_GENERIC_ERROR;
        }

        // 完成後只留結果，不再顯示標題與說明
        $("rs-title").hidden = which === "done";
        $("rs-lead").hidden = which !== "review";

        const focusId = which === "review" ? "rs-review-title"
            : which === "done" ? "rs-done-title" : "";

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


    function scheduleEl(lines) {

        const box = el("div");

        (lines || []).forEach((line) => {
            box.appendChild(el("div", "", line));
        });

        return box;

    }


    function roleText(role, rank, mode) {

        if (role !== "候補") {
            return "正取";
        }

        const base = rank ? "候補第 " + rank + " 位" : "候補";

        // 未能開課後的改期，候補排在其他候補之前；主動改期依付款先後排
        return mode === "passive" ? base + "（改期轉入，排在其他候補之前）" : base;

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
                action: "rescheduleLookup",
                regId: regId,
                token: token
            });

        } catch (err) {

            console.error("[reschedule] 查詢失敗（連線或回應格式）：", err);
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

                console.error("[reschedule] 非預期的回傳：", data);
                show("invalid", MSG_GENERIC_ERROR);

            }

        } catch (err) {

            console.error("[reschedule] 畫面顯示失敗：", err, data);
            show("invalid", MSG_GENERIC_ERROR);

        }

    }


    /* =====================================================
       04. 確認畫面
       ===================================================== */

    function renderReview() {

        const it = item;

        summaryEl.textContent = "";
        setError("rs-review-error", "");

        summaryEl.appendChild(rowEl("課程", it.courseName));
        const active = it.mode === "active";

        summaryEl.appendChild(rowEl("原開課日",
            fmtDate(it.oldDate) + (!active && it.reasonText ? "（" + it.reasonText + "）" : "")));
        summaryEl.appendChild(rowEl("報名編號", it.regId));

        if (it.dueText) {
            summaryEl.appendChild(rowEl("請在這天前選擇", it.dueText));
        }

        if (it.refundUrl) {
            refundLink.href = it.refundUrl;
            refundLink.textContent = active ? "不改期了，我要取消報名" : "我想改選全額退費";
            refundLink.hidden = false;
        } else {
            refundLink.hidden = true;
        }

        if (!it.hasNext) {

            messageEl.textContent = it.message ||
                "目前沒有可以改期的梯次（可能已額滿或已截止）。" +
                (active ? "若要取消報名，請點下方的連結；有任何問題請直接回覆信件告訴我。"
                    : "您可以選擇全額退費，或直接回覆通知信告訴我。");
            messageEl.hidden = false;
            warningEl.hidden = true;
            warningActiveEl.hidden = true;
            confirmBtn.hidden = true;
            show("review");
            return;

        }

        messageEl.hidden = true;
        warningEl.hidden = active;
        warningActiveEl.hidden = !active;
        confirmBtn.hidden = false;

        summaryEl.appendChild(rowEl("改期到", fmtDate(it.nextDate) + " 開課"));
        summaryEl.appendChild(rowEl("上課日程", scheduleEl(it.schedule)));
        summaryEl.appendChild(rowEl("您的身份", roleText(it.role, it.rank, it.mode)));
        summaryEl.appendChild(rowEl("款項", "已付款"));
        summaryEl.appendChild(rowEl("改期次數",
            it.nth + " 次（合計上限 " + (it.nthLimit || 2) + " 次）"));

        confirmBtn.textContent = "確認改期到 " + fmtDate(it.nextDate);

        show("review");

    }


    confirmBtn.addEventListener("click", async () => {

        if (busy || !item || !item.hasNext) {
            return;
        }

        busy = true;
        confirmBtn.disabled = true;

        const label = confirmBtn.textContent;
        confirmBtn.textContent = "處理中…";
        setError("rs-review-error", "");

        try {

            const data = await postJson({
                action: "rescheduleConfirm",
                regId: regId,
                token: token,
                expectedSession: item.nextSessionId
            });

            if (data && data.ok) {

                renderDone(data, !!data.already);

            } else if (data && data.changed && data.item) {

                // 按下確認的瞬間，可改期的梯次變了：請學員重新確認
                item = data.item;
                renderReview();
                setError("rs-review-error",
                    "可改期的梯次已更新為 " + fmtDate(item.nextDate) + " 開課，請確認後再按一次。");

            } else if (data && data.ok === false && data.error) {

                setError("rs-review-error", data.error);
                confirmBtn.textContent = label;

            } else {

                console.error("[reschedule] 非預期的回傳：", data);
                setError("rs-review-error", MSG_UNCERTAIN);
                confirmBtn.textContent = label;

            }

        } catch (err) {

            console.error("[reschedule] 確認失敗：", err);
            setError("rs-review-error", MSG_UNCERTAIN);
            confirmBtn.textContent = label;

        } finally {

            busy = false;
            confirmBtn.disabled = false;

        }

    });


    /* =====================================================
       05. 完成畫面
       ===================================================== */

    function renderDone(d, already) {

        const sum = $("rs-done-summary");
        const notes = $("rs-done-notes");

        sum.textContent = "";
        notes.textContent = "";

        sum.appendChild(rowEl("新的報名編號", d.regId));
        sum.appendChild(rowEl("課程", d.courseName));
        sum.appendChild(rowEl("開課日", fmtDate(d.date)));
        sum.appendChild(rowEl("您的身份", roleText(d.role, d.rank, d.mode)));

        if (d.schedule && d.schedule.length) {
            sum.appendChild(rowEl("上課日程", scheduleEl(d.schedule)));
        }

        notes.appendChild(el("li", "", "不需要重新付款。"));

        if (already) {

            notes.appendChild(el("li", "",
                "這筆報名先前已經完成改期，系統沒有重複處理。"));

        } else if (d.emailSent === false) {

            notes.appendChild(el("li", "",
                "改期完成信暫時沒有寄出。請截圖保存這一頁，我會盡快與您聯繫。"));

        } else {

            notes.appendChild(el("li", "",
                "改期完成信已寄到您的信箱，裡面有新的取消連結。若沒收到，請查看垃圾信件匣。"));

        }

        notes.appendChild(el("li", "",
            "有任何問題，請來信 " + CONTACT + "。"));

        show("done");

    }


    /* ===================================================== */

    init();

})();
