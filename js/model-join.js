/* =====================================================
JAMES GAZE
model-join.js — Model 招募頁

送出至 Apps Script 公開 API（action = modelJoin），
POST 一律 Content-Type: text/plain。
換正式網址時，只需更新下面的 API_URL（與 register.js 相同）。
===================================================== */

(function () {
    'use strict';

    var API_URL = 'https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec';
    var FALLBACK_MSG = '系統暫時無法處理，請以 IG 或 email 私訊告訴我，我會手動為您登記。';

    var form = document.getElementById('mj-form');
    if (!form) return;

    var submitBtn = document.getElementById('mj-submit');
    var formError = document.getElementById('mj-form-error');
    var result = document.getElementById('mj-result');
    var resultTitle = document.getElementById('mj-result-title');
    var consent = document.getElementById('f-consent');
    var sending = false;

    function val(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    }

    function setError(name, msg) {
        var box = form.querySelector('[data-error-for="' + name + '"]');
        if (box) box.textContent = msg || '';
        var field = form.elements[name];
        if (field && field.nodeType === 1) {
            if (msg) field.setAttribute('aria-invalid', 'true');
            else field.removeAttribute('aria-invalid');
        }
    }

    function clearErrors() {
        var boxes = form.querySelectorAll('[data-error-for]');
        for (var i = 0; i < boxes.length; i++) boxes[i].textContent = '';
        var bad = form.querySelectorAll('[aria-invalid]');
        for (var j = 0; j < bad.length; j++) bad[j].removeAttribute('aria-invalid');
        formError.textContent = '';
    }

    function igOk(v) {
        var t = v.replace(/\s+/g, '').replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '');
        t = t.split(/[?#\/]/)[0].replace(/^@/, '');
        return /^[A-Za-z0-9._]{1,30}$/.test(t);
    }

    function urlOk(v) {
        var t = v.replace(/\s+/g, '');
        if (!t) return false;
        if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
        return /^https?:\/\/[^\s\/$.?#][^\s]*\.[^\s]{2,}$/i.test(t);
    }

    function checkedThemes() {
        var out = [];
        var boxes = form.querySelectorAll('input[name="themes"]');
        for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) out.push(boxes[i].value);
        return out;
    }

    // 回傳 { 欄位名: 錯誤訊息 }，空物件＝通過
    function validate() {
        var e = {};
        if (val('f-name').length < 2) e.name = '請填寫姓名。';
        if (!val('f-gender')) e.gender = '請選擇性別。';

        if (!form.elements.ageOk.checked) e.ageOk = '請勾選聲明年滿 18 歲。';

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('f-email'))) e.email = 'Email 格式不正確。';
        if (!igOk(val('f-ig'))) e.ig = 'IG 帳號格式不正確（例如 @jamesgaze）。';
        if (val('f-portfolio') && !urlOk(val('f-portfolio'))) e.portfolio = '作品集網址格式不正確（請以 https:// 開頭），或留白不填。';
        if (!val('f-time')) e.time = '請選擇可配合時間。';
        if (!val('f-mode')) e.mode = '請選擇合作形式。';
        if (!val('f-area')) e.area = '請選擇可配合地點。';
        if (!val('f-place')) e.place = '請選擇可配合場域。';
        if (!checkedThemes().length) e.themes = '請至少選擇一項可接受的拍攝主題。';
        if (!consent.checked) e.consent = '請先勾選同意個人資料告知事項。';
        return e;
    }

    function showErrors(errs) {
        var first = null;
        Object.keys(errs).forEach(function (k) {
            setError(k, errs[k]);
            if (!first) first = k;
        });
        if (first) {
            var box = form.querySelector('[data-error-for="' + first + '"]');
            var target = form.elements[first];
            if (target && target.nodeType === 1 && target.focus) target.focus();
            else if (box && box.scrollIntoView) box.scrollIntoView({ block: 'center' });
        }
    }

    consent.addEventListener('change', function () {
        submitBtn.disabled = !consent.checked || sending;
        if (consent.checked) setError('consent', '');
    });

    // 欄位被修改就清掉該欄的紅框
    form.addEventListener('input', function (ev) {
        var n = ev.target && ev.target.name;
        if (n && n !== 'consent') setError(n, '');
    });
    form.addEventListener('change', function (ev) {
        var n = ev.target && ev.target.name;
        if (n && n !== 'consent') setError(n, '');
    });

    function showResult() {
        form.hidden = true;
        result.hidden = false;
        resultTitle.focus();
        if (result.scrollIntoView) result.scrollIntoView({ block: 'start' });
    }

    form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (sending) return;
        clearErrors();

        var errs = validate();
        if (Object.keys(errs).length) {
            showErrors(errs);
            return;
        }

        var payload = {
            action: 'modelJoin',
            name: val('f-name'),
            nickname: val('f-nickname'),
            gender: val('f-gender'),
            ageOk: form.elements.ageOk.checked === true,
            email: val('f-email'),
            ig: val('f-ig'),
            portfolio: val('f-portfolio'),
            time: val('f-time'),
            mode: val('f-mode'),
            area: val('f-area'),
            place: val('f-place'),
            themes: checkedThemes(),
            consent: consent.checked === true,
            hp_contact: val('f-hp')
        };

        sending = true;
        submitBtn.disabled = true;
        submitBtn.textContent = '送出中…';

        var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;

        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            signal: ctrl ? ctrl.signal : undefined
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.ok) {
                    showResult();
                } else {
                    formError.textContent = (data && data.error) || FALLBACK_MSG;
                    formError.scrollIntoView({ block: 'center' });
                }
            })
            .catch(function () {
                formError.textContent = FALLBACK_MSG;
                formError.scrollIntoView({ block: 'center' });
            })
            .then(function () {
                if (timer) clearTimeout(timer);
                sending = false;
                submitBtn.textContent = '送出申請';
                submitBtn.disabled = !consent.checked;
            });
    });
})();
