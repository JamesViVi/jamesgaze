/* =========================================================
   James Gaze
   about.js

   About 頁專用邏輯，獨立於 script.js 之外。
   目前只做一件事：滾動淡入（scroll reveal）。

   架構
   ---------------------------------------------------------
   01. Global State
   02. Hero 進場（頁面載入時，不是滾動觸發）
   03. Scroll Reveal（其餘 section 滾動進場淡入）
   04. Initialization
   ========================================================= */


document.addEventListener("DOMContentLoaded", () => {


    /* =====================================================
       01. GLOBAL STATE
       ===================================================== */

    const state = {

        prefersReducedMotion:
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches

    };



    /* =====================================================
       02. HERO 進場

       Hero 一打開頁面就在畫面上，不需要（也不能）用
       IntersectionObserver 等它「進入視窗」，
       這裡直接在頁面載入後，短暫延遲一下再淡入，
       避免跟字體/圖片載入的瞬間閃爍疊在一起。
       ===================================================== */

    function initHeroReveal() {

        const title =
            document.querySelector(".about-hero-title");

        const subtitle =
            document.querySelector(".about-hero-subtitle");


        if (!title && !subtitle) {

            return;

        }


        [title, subtitle].forEach(
            (el) => {

                if (el) {

                    el.classList.add(
                        "about-reveal-text"
                    );

                }

            }
        );


        if (state.prefersReducedMotion) {

            return;

        }


        if (subtitle) {

            subtitle.style.setProperty(
                "--about-reveal-delay",
                "120ms"
            );

        }


        requestAnimationFrame(
            () => {

                requestAnimationFrame(
                    () => {

                        if (title) {

                            title.classList.add(
                                "jg-reveal-visible"
                            );

                        }


                        if (subtitle) {

                            subtitle.classList.add(
                                "jg-reveal-visible"
                            );

                        }

                    }
                );

            }
        );

    }



    /* =====================================================
       03. SCROLL REVEAL

       trigger 進入視窗 → target(s) 一起加上 .jg-reveal-visible，
       加過一次就 unobserve（不會重複觸發）。
       多個 target 時用 --about-reveal-delay 做 stagger。
       ===================================================== */

    function initScrollReveal() {

        if (state.prefersReducedMotion) {

            return;

        }


        if (!("IntersectionObserver" in window)) {

            document.querySelectorAll(
                ".about-reveal-text, .about-reveal-image, " +
                ".about-reveal-fade"
            ).forEach(
                (el) => {

                    el.classList.add(
                        "jg-reveal-visible"
                    );

                }
            );

            return;

        }


        function addStagger(targets, stepMs) {

            targets.forEach(
                (target, index) => {

                    target.style.setProperty(
                        "--about-reveal-delay",
                        (index * stepMs) + "ms"
                    );

                }
            );

        }


        /*
            幫既有的 about- 元素動態掛上 reveal class，
            不用另外改 HTML。
        */

        document.querySelectorAll(
            "#opening .about-section-inner, " +
            "#opening-2 .about-section-col, " +
            "#experience .about-section-inner, " +
            "#feeling .about-section-col, " +
            "#method > .about-section-title, " +
            "#method .method-item, " +
            "#portrait .about-portrait-text, " +
            "#gaze .about-gaze-text, " +
            "#story-1, #story-2"
        ).forEach(
            (el) => {

                el.classList.add(
                    "about-reveal-text"
                );

            }
        );


        document.querySelectorAll(
            "#portrait .about-portrait-figure, " +
            "#gaze .about-gaze-figure"
        ).forEach(
            (el) => {

                el.classList.add(
                    "about-reveal-image"
                );

            }
        );


        const credentials =
            document.querySelectorAll(
                "#credentials .credential"
            );

        credentials.forEach(
            (el) => {

                el.classList.add(
                    "about-reveal-text"
                );

            }
        );

        addStagger(credentials, 100);


        const methodItems =
            document.querySelectorAll(
                "#method .method-item"
            );

        addStagger(methodItems, 100);


        document.querySelectorAll(
            "#final-cta .final-cta-inner"
        ).forEach(
            (el) => {

                el.classList.add(
                    "about-reveal-fade"
                );

            }
        );


        /*
            trigger 進入視窗 → target(s) 一起淡入。
            trigger 跟 target 相同時，就是「自己進場、自己淡入」
            （金句、案例小故事都是這種）。
        */

        const groups = [

            {
                trigger: document.querySelector("#opening"),
                targets: document.querySelectorAll("#opening .about-section-inner")
            },

            {
                trigger: document.querySelector("#opening-2"),
                targets: document.querySelectorAll("#opening-2 .about-section-col")
            },

            {
                trigger: document.querySelector("#experience"),
                targets: document.querySelectorAll("#experience .about-section-inner")
            },

            {
                trigger: document.querySelector("#feeling"),
                targets: document.querySelectorAll("#feeling .about-section-col")
            },

            {
                trigger: document.querySelector("#method"),
                targets: document.querySelectorAll(
                    "#method > .about-section-title, #method .method-item"
                )
            },

            {
                trigger: document.querySelector("#story-1"),
                targets: document.querySelectorAll("#story-1")
            },

            {
                trigger: document.querySelector("#story-2"),
                targets: document.querySelectorAll("#story-2")
            },

            {
                trigger: document.querySelector("#portrait"),
                targets: document.querySelectorAll(
                    "#portrait .about-portrait-figure, #portrait .about-portrait-text"
                )
            },

            {
                trigger: document.querySelector("#credentials"),
                targets: credentials
            },

            {
                trigger: document.querySelector("#gaze"),
                targets: document.querySelectorAll(
                    "#gaze .about-gaze-text, #gaze .about-gaze-figure"
                )
            },

            {
                trigger: document.querySelector("#final-cta"),
                targets: document.querySelectorAll("#final-cta .final-cta-inner")
            }

        ].filter(
            (group) => {

                return (
                    group.trigger &&
                    group.targets &&
                    group.targets.length
                );

            }
        );


        function revealEntries(entries, observer) {

            entries.forEach(
                (entry) => {

                    if (!entry.isIntersecting) {

                        return;

                    }


                    const group =
                        groups.find(
                            (item) => item.trigger === entry.target
                        );


                    if (!group) {

                        return;

                    }


                    group.targets.forEach(
                        (target) => {

                            target.classList.add(
                                "jg-reveal-visible"
                            );

                        }
                    );


                    observer.unobserve(
                        entry.target
                    );

                }
            );

        }


        const observer =
            new IntersectionObserver(
                revealEntries,
                {
                    threshold: 0.15,
                    rootMargin: "0px 0px -10% 0px"
                }
            );


        groups.forEach(
            (group) => {

                observer.observe(
                    group.trigger
                );

            }
        );

    }



    /* =====================================================
       04. INITIALIZATION
       ===================================================== */

    initHeroReveal();

    initScrollReveal();


});
