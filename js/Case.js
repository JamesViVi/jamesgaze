/* =====================================================
JAMES GAZE
Case.js — V10

Case01 / Case02 / Case03 共用互動腳本。
獨立於 script.js，不依賴其內部實作，
只負責本頁新增的元件：

  1. 前後對比拖曳滑桿（.cs-compare）
  2. 區塊進場淡入（.cs-reveal），與全站風格一致的漸進顯示

===================================================== */

(function () {

    "use strict";



    /* =================================================
    01. COMPARE SLIDER

    DOM 結構：

    <div class="cs-compare" data-compare>
        <div class="cs-compare-base"><img></div>
        <div class="cs-compare-reveal" data-compare-reveal><img></div>
        <div class="cs-compare-divider" data-compare-divider></div>
        <div class="cs-compare-handle" data-compare-handle></div>
        <input class="cs-compare-range" type="range" data-compare-range>
    </div>

    第一張圖（base）永遠完整顯示，
    第二張圖（reveal）依滑桿百分比用 clip-path 裁切顯示，
    藉此模擬「拖曳看前後對比」的效果。
    ================================================= */

    function initCompareSliders() {

        var sliders = document.querySelectorAll("[data-compare]");

        sliders.forEach(function (root) {

            var reveal = root.querySelector("[data-compare-reveal]");
            var divider = root.querySelector("[data-compare-divider]");
            var handle = root.querySelector("[data-compare-handle]");
            var range = root.querySelector("[data-compare-range]");

            if (!reveal || !range) {
                return;
            }

            function setPosition(percent) {

                var clamped = Math.min(100, Math.max(0, percent));

                reveal.style.clipPath =
                    "inset(0 " + (100 - clamped) + "% 0 0)";

                if (divider) {
                    divider.style.left = clamped + "%";
                }

                if (handle) {
                    handle.style.left = clamped + "%";
                }

            }

            // 初始位置：讀取 range 的預設 value（HTML 可自行調整起始比例）

            setPosition(parseFloat(range.value) || 50);

            range.addEventListener("input", function () {
                setPosition(parseFloat(range.value));
            });

            // 讓整個元件也能直接拖曳 / 點擊（不只是命中隱藏的 input 範圍）

            var isDragging = false;

            function updateFromClientX(clientX) {

                var rect = root.getBoundingClientRect();

                if (rect.width === 0) {
                    return;
                }

                var percent = ((clientX - rect.left) / rect.width) * 100;

                range.value = percent;

                setPosition(percent);

            }

            root.addEventListener("pointerdown", function (event) {

                isDragging = true;

                root.setPointerCapture(event.pointerId);

                updateFromClientX(event.clientX);

            });

            root.addEventListener("pointermove", function (event) {

                if (!isDragging) {
                    return;
                }

                updateFromClientX(event.clientX);

            });

            function stopDragging(event) {

                isDragging = false;

                if (event.pointerId !== undefined) {

                    try {
                        root.releasePointerCapture(event.pointerId);
                    } catch (err) {
                        /* pointer 已釋放則忽略 */
                    }

                }

            }

            root.addEventListener("pointerup", stopDragging);
            root.addEventListener("pointercancel", stopDragging);

        });

    }



    /* =================================================
    02. SCROLL REVEAL

    輕量進場動畫：元素進入畫面時加上 .is-visible。
    找不到 .cs-reveal 元素時完全不影響其他功能。
    ================================================= */

    function initScrollReveal() {

        var targets = document.querySelectorAll(".cs-reveal");

        if (!targets.length) {
            return;
        }

        if (!("IntersectionObserver" in window)) {

            targets.forEach(function (el) {
                el.classList.add("is-visible");
            });

            return;

        }

        var observer = new IntersectionObserver(
            function (entries) {

                entries.forEach(function (entry) {

                    if (entry.isIntersecting) {

                        entry.target.classList.add("is-visible");

                        observer.unobserve(entry.target);

                    }

                });

            },
            {
                threshold: 0.2
            }
        );

        targets.forEach(function (el) {
            observer.observe(el);
        });

    }



    /* =================================================
    INIT
    ================================================= */

    document.addEventListener("DOMContentLoaded", function () {

        initCompareSliders();

        initScrollReveal();

    });

}());
