/* =========================================================
   James Gaze
   review.js — 課程評價頁

   兩種進入方式
   ---------------------------------------------------------
   review.html?s=梯次ID            現場 QR：學員輸入報名 Email 驗證
   review.html?r=報名編號&k=簽章    信件專屬連結：不用輸入 Email
   API（POST，text/plain）：reviewLookup、reviewSubmit
   換正式網址時，更新下面的 API_URL（與 cancel.js 相同）
   ========================================================= */

(function () {

    "use strict";

    const API_URL =
        "https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec";

    const POST_TIMEOUT_MS = 45000;
    const MSG_NO_LINK = "請使用課堂上的 QR 碼，或信件中的評價連結進入這一頁。找不到的話，請來信。";
    const MSG_NETWORK = "網路連線不穩，沒有查到結果。請重新整理頁面再試一次。";
    const MSG_GENERIC = "系統暫時無法處理，請稍後再試，或來信 jamesgaze.tw@gmail.com。";

    const $ = (id) => document.getElementById(id);

    const query = new URLSearchParams(window.location.search);
    const sessionId = (query.get("s") || "").trim().slice(0, 40);
    const regId = (query.get("r") || "").trim().slice(0, 20);
    const token = (query.get("k") || "").trim().slice(0, 64);

    const emailForm = $("rv-email-form");
    const form = $("rv-form");

    let creds = null;
    let busy = false;

    function el(tag, text) {
        const n = document.createElement(tag);
        if (text !== undefined) { n.textContent = text; }
        return n;
    }

    async function postJson(payload) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
        try {
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
        $("rv-loading").hidden = which !== "loading";
        $("rv-invalid").hidden = which !== "invalid";
        emailForm.hidden = which !== "email";
        form.hidden = which !== "form";
        $("rv-done").hidden = which !== "done";
        if (which === "invalid") { $("rv-invalid-text").textContent = text || MSG_GENERIC; }
        $("rv-title").hidden = which === "done";
        $("rv-lead").hidden = which !== "email" && which !== "form";
        if (which === "done") {
            const n = $("rv-done-title");
            n.scrollIntoView({ behavior: "smooth", block: "start" });
            n.focus({ preventScroll: true });
        }
    }

    function setErr(name, msg) {
        const box = form.querySelector('[data-error-for="' + name + '"]');
        if (box) { box.textContent = msg || ""; }
        const f = form.elements[name];
        if (f && f.nodeType === 1) {
            if (msg) { f.setAttribute("aria-invalid", "true"); } else { f.removeAttribute("aria-invalid"); }
        }
    }

    function renderDone(already) {
        const notes = $("rv-done-notes");
        notes.textContent = "";
        notes.appendChild(el("li", already
            ? "您先前已經填寫過這一梯的回饋了，謝謝您。"
            : "我已經收到您的回饋，會用它來調整之後的課程。"));
        notes.appendChild(el("li", "有任何想法，也歡迎直接來信 jamesgaze.tw@gmail.com。"));
        show("done");
    }

    function renderForm(item) {
        const sum = $("rv-summary");
        sum.textContent = "";
        const row = el("div");
        row.appendChild(el("dt", "課程"));
        row.appendChild(el("dd", item.courseName));
        sum.appendChild(row);
        show("form");
    }

    async function lookup(payload, fromEmailStep) {
        show("loading");
        let data = null;
        try {
            data = await postJson(Object.assign({ action: "reviewLookup" }, payload));
        } catch (err) {
            console.error("[review] 查詢失敗：", err);
            if (fromEmailStep) {
                show("email");
                $("rv-email-error").textContent = MSG_NETWORK;
            } else {
                show("invalid", MSG_NETWORK);
            }
            return;
        }
        if (data && data.ok && data.already) { creds = payload; renderDone(true); return; }
        if (data && data.ok && data.item) { creds = payload; renderForm(data.item); return; }
        const msg = (data && data.error) || MSG_GENERIC;
        if (fromEmailStep && !(data && data.notYet)) {
            show("email");
            $("rv-email-error").textContent = msg;
        } else {
            show("invalid", msg);
        }
    }

    emailForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (busy) { return; }
        $("rv-email-error").textContent = "";
        const email = $("rv-email").value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            $("rv-email-error").textContent = "請填寫報名時使用的電子郵件。";
            return;
        }
        lookup({ sessionId: sessionId, email: email }, true);
    });

    function clearErrors() {
        form.querySelectorAll("[data-error-for]").forEach((n) => { n.textContent = ""; });
        form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
        $("rv-form-error").textContent = "";
    }

    form.addEventListener("input", (ev) => {
        const n = ev.target && ev.target.name;
        if (n) { setErr(n, ""); }
    });

    form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        if (busy || !creds) { return; }
        clearErrors();

        const checked = form.querySelector('input[name="stars"]:checked');
        const helpful = form.elements.helpful.value.trim();
        const recommend = form.elements.recommend.value.trim();
        const showName = form.elements.name.value.trim();
        let bad = false;

        if (!checked) { setErr("stars", "請選擇整體星等。"); bad = true; }
        if (helpful.length < 5) { setErr("helpful", "請寫下這堂課對您最有幫助的地方（至少 5 個字）。"); bad = true; }
        if (recommend.length < 3) { setErr("recommend", "請寫下您會把這堂課推薦給什麼樣的人。"); bad = true; }
        if (!showName) { setErr("name", "請填寫要顯示的姓名或暱稱（不想具名請填「匿名學員」）。"); bad = true; }
        if (bad) {
            const first = form.querySelector('[data-error-for]:not(:empty)');
            if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); }
            return;
        }

        busy = true;
        const btn = $("rv-submit");
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = "送出中…";

        try {
            const data = await postJson(Object.assign({
                action: "reviewSubmit",
                stars: Number(checked.value),
                name: showName,
                helpful: helpful,
                recommend: recommend,
                improve: form.elements.improve.value.trim(),
                hp_contact: form.elements.hp_contact.value
            }, creds));
            if (data && data.ok) {
                renderDone(!!data.already);
            } else {
                $("rv-form-error").textContent = (data && data.error) || MSG_GENERIC;
            }
        } catch (err) {
            console.error("[review] 送出失敗：", err);
            $("rv-form-error").textContent = "無法確認是否已送出。請稍後重新整理頁面：若顯示「已經填寫過」，就是成功了。";
        } finally {
            busy = false;
            btn.disabled = false;
            btn.textContent = label;
        }
    });

    if (regId && token) {
        lookup({ regId: regId, token: token }, false);
    } else if (sessionId) {
        show("email");
    } else {
        show("invalid", MSG_NO_LINK);
    }

})();
