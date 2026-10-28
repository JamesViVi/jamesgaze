/* =========================================================
   James Gaze
   transfer.js — 名額轉讓頁（受讓人，信件專屬連結）

   流程
   ---------------------------------------------------------
   01. 設定
   02. 工具
   03. 讀取連結 → 查詢這一筆轉讓（transferLookup）
   04. 契約全文（從 register.html 讀取，契約只維護一份）
   05. 表單驗證與送出（transferAccept）
   06. 完成畫面
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       01. 設定（換正式網址時，只需要改這裡）
       ===================================================== */

    const API_URL =
        "https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec";

    const POST_TIMEOUT_MS = 45000;
    const CONTACT = "jamesgaze.tw@gmail.com";

    const MSG_NO_LINK =
        "請從轉讓邀請信中的專屬連結進入這一頁。找不到信的話，請來信，我會協助您。";

    const MSG_NETWORK =
        "網路連線不穩，沒有查到結果。請重新整理頁面再試一次；若持續發生，請來信告訴我。";

    const MSG_GENERIC_ERROR =
        "系統暫時無法處理，請來信告訴我，我會協助您。";

    const MSG_UNCERTAIN =
        "無法確認轉讓是否已完成。請先檢查信箱是否收到「轉讓完成」的信；" +
        "若沒有收到，可以再按一次「確認受讓」，系統不會重複處理。";


    /* =====================================================
       02. 工具
       ===================================================== */

    const $ = (id) => document.getElementById(id);

    const loadingEl = $("tf-loading");
    const invalidEl = $("tf-invalid");
    const formEl = $("tf-form");
    const doneEl = $("tf-done");
    const submitBtn = $("tf-submit");

    const query = new URLSearchParams(window.location.search);
    const transferId = (query.get("t") || "").trim().slice(0, 20);
    const token = (query.get("k") || "").trim().slice(0, 64);

    let item = null;
    let siteParams = null;
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
        formEl.hidden = which !== "form";
        doneEl.hidden = which !== "done";

        if (which === "invalid") {
            $("tf-invalid-text").textContent = text || MSG_GENERIC_ERROR;
        }

        // 完成後只留結果，不再顯示標題與說明
        $("tf-title").hidden = which === "done";
        $("tf-lead").hidden = which !== "form";

        if (which === "done") {

            const node = $("tf-done-title");
            node.scrollIntoView({ behavior: "smooth", block: "start" });
            node.focus({ preventScroll: true });

        }

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
       數字（契約全文裡的 data-term）：讀 API，不寫死
       ===================================================== */

    function termValue(key) {

        const p = siteParams;
        const parts = key.split(":");
        const name = parts[0];
        const course = parts[1];

        const perCourse = (v) => (
            v && typeof v === "object" ? (course in v ? v[course] : null) : v
        );

        switch (name) {

            case "mainCap":
                return item && item.mainCap ? String(item.mainCap) : null;

            case "waitCap":
                return item && item.waitCap ? String(item.waitCap) : null;

            case "minPeople":
                return p ? (perCourse(p.minPeople) === null ? null : String(perCourse(p.minPeople))) : null;

            case "deadlineDays":
                return p ? String(p.deadlineDays) : null;

            case "deadlineDayN":
                return p && p.deadlineDays ? String(Number(p.deadlineDays) + 1) : null;

            case "refundDays":
                return p ? String(p.refundDays) : null;

            case "refundPct":
                return p && p.refundPct && course in p.refundPct
                    ? p.refundPct[course] + "%" : null;

            case "refundStartSeq":
                return p && p.refundStartSeq && course in p.refundStartSeq
                    ? String(p.refundStartSeq[course]) : null;

            case "rescheduleMax":
                return p && p.rescheduleMax ? String(p.rescheduleMax) : null;

            case "abandonDays":
                return p && p.abandonDays ? String(p.abandonDays) : null;

            case "transferDays":
                return p && p.transferDays ? String(p.transferDays) : null;

            case "replyDays":
                return p && p.replyDays ? String(p.replyDays) : null;

            default:
                return null;

        }

    }


    function applyTerms() {

        document.querySelectorAll("[data-term]").forEach((node) => {

            const v = termValue(node.getAttribute("data-term"));

            if (v !== null && v !== "NaN") {
                node.textContent = v;
            }

        });

    }


    async function loadParams() {

        try {

            const res = await fetch(API_URL + "?action=sessions");
            const data = await res.json();
            siteParams = (data && data.params) || null;

        } catch (err) {

            console.error("[transfer] 讀取參數失敗，契約數字使用備用值：", err);

        }

    }


    /* =====================================================
       03. 讀取連結 → 查詢這一筆轉讓
       ===================================================== */

    async function init() {

        if (!transferId || !token) {
            show("invalid", MSG_NO_LINK);
            return;
        }

        show("loading");

        let data = null;

        try {

            data = await postJson({
                action: "transferLookup",
                transferId: transferId,
                token: token
            });

        } catch (err) {

            console.error("[transfer] 查詢失敗（連線或回應格式）：", err);
            show("invalid", MSG_NETWORK);
            return;

        }

        try {

            if (data && data.ok && data.already && data.done) {

                renderDone(data.done, true);

            } else if (data && data.ok && data.item) {

                item = data.item;
                renderForm();
                await Promise.all([loadParams(), loadContract()]);
                applyTerms();

            } else if (data && data.ok === false && data.error) {

                show("invalid", data.error);

            } else {

                console.error("[transfer] 非預期的回傳：", data);
                show("invalid", MSG_GENERIC_ERROR);

            }

        } catch (err) {

            console.error("[transfer] 畫面顯示失敗：", err, data);
            show("invalid", MSG_GENERIC_ERROR);

        }

    }


    function renderForm() {

        const it = item;
        const sum = $("tf-summary");

        sum.textContent = "";

        sum.appendChild(rowEl("課程", it.courseName));
        sum.appendChild(rowEl("開課日", fmtDate(it.date)));

        if (it.schedule && it.schedule.length) {

            const ul = el("ul", "reg-sched-lines");

            it.schedule.forEach((line) => ul.appendChild(el("li", "", line)));

            sum.appendChild(rowEl("上課日程", ul));

        }

        sum.appendChild(rowEl("原已付款", fmtMoney(it.received)));
        sum.appendChild(rowEl("您的身份", it.role || "正取"));
        sum.appendChild(rowEl("完成期限", it.deadlineText));

        $("tf-email-hint").textContent =
            "這封邀請寄到 " + it.emailMasked +
            "，轉讓成立後，您的報名與通知都會使用這個信箱，無法更改。";

        show("form");

    }


    /* =====================================================
       04. 契約全文（從 register.html 讀取，契約只維護一份）
       ===================================================== */

    async function loadContract() {

        const box = $("tf-contract");

        try {

            const res = await fetch("register.html", { cache: "no-cache" });

            if (!res.ok) {
                throw new Error("HTTP " + res.status);
            }

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const src = doc.getElementById("contract-text");

            if (!src) {
                throw new Error("找不到 #contract-text");
            }

            box.textContent = "";

            Array.from(src.childNodes).forEach((n) => {
                box.appendChild(document.importNode(n, true));
            });

            // 契約裡的連結一律另開分頁，避免離開這一頁而遺失填寫內容
            box.querySelectorAll("a").forEach((a) => {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            });

        } catch (err) {

            console.error("[transfer] 契約載入失敗：", err);

            box.textContent = "";

            const p = el("p", "", "契約全文暫時無法在此顯示，請先到報名頁閱讀：");
            const a = el("a", "", "《課程服務契約》全文");
            a.href = "register.html";
            a.target = "_blank";
            a.rel = "noopener noreferrer";

            p.appendChild(a);
            box.appendChild(p);

        }

    }


    /* =====================================================
       05. 表單驗證與送出
       ===================================================== */

    function digits(v) {
        return String(v).trim().replace(/[\s-]/g, "");
    }

    function collect() {

        const f = formEl.elements;

        return {
            name: f.name.value.trim(),
            phone: digits(f.phone.value),
            line: f.line.value.trim(),
            bankCode: digits(f.bankCode.value),
            account: digits(f.account.value),
            accountName: f.accountName.value.trim(),
            agreed: f.agreed.checked,
            ageOk: f.ageOk.checked,
            settleOk: f.settleOk.checked,
            portraitOk: f.portraitOk.checked,
            hp_contact: f.hp_contact.value
        };

    }


    function validate(v) {

        const errs = {};

        if (v.name.length < 2) {
            errs.name = "請填寫姓名。";
        }

        if (!/^09\d{8}$/.test(v.phone)) {
            errs.phone = "請填寫 10 碼手機號碼（例如 0912345678）。";
        }

        if (!/^\d{3,7}$/.test(v.bankCode)) {
            errs.bankCode = "銀行代碼請填 3 到 7 位數字。";
        }

        if (!/^\d{6,16}$/.test(v.account)) {
            errs.account = "帳號請填 6 到 16 位數字。";
        }

        if (v.accountName.length < 2) {
            errs.accountName = "請填寫戶名。";
        }

        if (!v.agreed) {
            errs.agreed = "請先閱讀並勾選同意課程服務契約。";
        }

        if (!v.ageOk) {
            errs.ageOk = "請勾選聲明年滿 18 歲。";
        }

        if (!v.settleOk) {
            errs.settleOk = "請勾選自行結算的聲明。";
        }

        return errs;

    }


    function errorNode(key) {
        return formEl.querySelector('[data-error-for="' + key + '"]');
    }

    function clearErrors() {

        formEl.querySelectorAll("[data-error-for]").forEach((n) => {
            n.textContent = "";
        });

        $("tf-form-error").textContent = "";

    }

    function showErrors(errs) {

        let first = null;

        Object.keys(errs).forEach((k) => {

            const n = errorNode(k);

            if (n) {
                n.textContent = errs[k];
            }

            if (!first) {
                first = n;
            }

        });

        if (first) {
            first.scrollIntoView({ behavior: "smooth", block: "center" });
        }

    }


    function updateSubmitState() {

        const ok = $("tf-agreed").checked &&
            $("tf-ageOk").checked &&
            $("tf-settleOk").checked;

        submitBtn.disabled = !ok || busy;

    }

    ["tf-agreed", "tf-ageOk", "tf-settleOk"].forEach((id) => {
        $(id).addEventListener("change", updateSubmitState);
    });


    formEl.addEventListener("submit", async (ev) => {

        ev.preventDefault();

        if (busy || !item) {
            return;
        }

        clearErrors();

        const v = collect();
        const errs = validate(v);

        if (Object.keys(errs).length) {
            showErrors(errs);
            return;
        }

        busy = true;
        submitBtn.disabled = true;

        const label = submitBtn.textContent;
        submitBtn.textContent = "處理中…";

        try {

            const data = await postJson({
                action: "transferAccept",
                transferId: transferId,
                token: token,
                name: v.name,
                phone: v.phone,
                line: v.line,
                bankCode: v.bankCode,
                account: v.account,
                accountName: v.accountName,
                agreed: v.agreed,
                ageOk: v.ageOk,
                settleOk: v.settleOk,
                portraitOk: v.portraitOk,
                hp_contact: v.hp_contact
            });

            if (data && data.ok && data.done) {

                renderDone(data.done, !!data.already);

            } else if (data && data.ok === false && data.error) {

                $("tf-form-error").textContent = data.error;

            } else {

                console.error("[transfer] 非預期的回傳：", data);
                $("tf-form-error").textContent = MSG_UNCERTAIN;

            }

        } catch (err) {

            console.error("[transfer] 送出失敗：", err);
            $("tf-form-error").textContent = MSG_UNCERTAIN;

        } finally {

            busy = false;
            submitBtn.textContent = label;
            updateSubmitState();

        }

    });


    /* =====================================================
       06. 完成畫面
       ===================================================== */

    function renderDone(d, already) {

        const sum = $("tf-done-summary");
        const notes = $("tf-done-notes");

        sum.textContent = "";
        notes.textContent = "";

        sum.appendChild(rowEl("新的報名編號", d.regId));
        sum.appendChild(rowEl("課程", d.courseName));
        sum.appendChild(rowEl("開課日", fmtDate(d.date)));
        sum.appendChild(rowEl("您的身份", d.role || "正取"));

        if (already) {

            notes.appendChild(el("li", "",
                "這筆轉讓先前已經完成，系統沒有重複處理。"));

        } else if (d.emailSent === false) {

            notes.appendChild(el("li", "",
                "確認信暫時沒有寄出。請截圖保存這一頁，我會盡快與您聯繫。"));

        } else {

            notes.appendChild(el("li", "",
                "確認信已寄到您的信箱，裡面有上課資訊與您的專屬取消連結。若沒收到，請查看垃圾信件匣。"));

        }

        notes.appendChild(el("li", "",
            "您不需要再向我付款；與轉讓人之間的款項，請自行結算。"));

        notes.appendChild(el("li", "",
            "有任何問題，請來信 " + CONTACT + "。"));

        show("done");

    }


    /* ===================================================== */

    init();

})();
