/* =========================================================
   James Gaze V7.1 Main JavaScript

   Architecture
   ---------------------------------------------------------
   01. Global State
   02. Scroll Engine
   03. Header
   04. Hero
   05. Hero Responsive
   06. Selected Works Config
   07. Selected Works Data
   08. Selected Works Rotation
   09. Selected Works Brightness Detection
   10. Selected Works Loader
   11. Case Study Mobile Dots
   12. Mobile Menu
   13. Section Scroll Effects
   14. Initialization
   ========================================================= */


document.addEventListener("DOMContentLoaded", () => {


    /* =====================================================
       01. GLOBAL STATE
       ===================================================== */

    const state = {

        scrollY: window.scrollY || 0,

        ticking: false,

        isMobileMenuOpen: false,

        prefersReducedMotion:
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches

    };


    /* =====================================================
       02. SCROLL ENGINE

       所有 scroll 效果統一由這裡管理。

       不再讓：
       Header / Hero / Section
       各自建立 scroll listener。

       結構：

       scroll
          ↓
       requestAnimationFrame
          ↓
       updateScrollEffects()
          ↓
       Header
       Hero
       Section Reveal
       ===================================================== */

    const scrollModules = [];


    function registerScrollModule(moduleFunction) {

        if (typeof moduleFunction === "function") {

            scrollModules.push(moduleFunction);

        }

    }


    function updateScrollEffects() {

        state.scrollY = window.scrollY || 0;

        scrollModules.forEach((moduleFunction) => {

            try {

                moduleFunction(state.scrollY);

            } catch (error) {

                console.warn(
                    "James Gaze V7.1 Scroll Module Error:",
                    error
                );

            }

        });

    }


    function requestScrollUpdate() {

        if (state.ticking) {

            return;

        }

        state.ticking = true;

        window.requestAnimationFrame(() => {

            updateScrollEffects();

            state.ticking = false;

        });

    }


    window.addEventListener(
        "scroll",
        requestScrollUpdate,
        {
            passive: true
        }
    );


    /* =====================================================
       03. HEADER

       原本功能：

       scrollY > 50
       → .scrolled

       保留原本行為。
       ===================================================== */

    function initHeader() {

        const header =
            document.querySelector(
                ".site-header"
            );

        if (!header) {

            return;

        }


        function updateHeader(scrollY) {

            if (scrollY > 50) {

                header.classList.add(
                    "scrolled"
                );

            } else {

                header.classList.remove(
                    "scrolled"
                );

            }

        }


        registerScrollModule(
            updateHeader
        );


        updateHeader(
            state.scrollY
        );

    }


    /* =====================================================
       04. HERO

       Viewfinder / 觀景窗

       左上：
       scroll → X +21 / Y +14

       右下：
       scroll → X -21 / Y -14

       保留 V7 原本數值。
       ===================================================== */

    function initHero() {

        const heroBracketLeft =
            document.querySelector(
                ".hero-title-bracket-left"
            );

        const heroBracketRight =
            document.querySelector(
                ".hero-title-bracket-right"
            );


        if (
            !heroBracketLeft ||
            !heroBracketRight
        ) {

            return;

        }


        function updateHeroBracketPosition(
            scrollY
        ) {

            const progress =
                Math.min(
                    scrollY / 300,
                    1
                );


            const moveX =
                21 * progress;

            const moveY =
                14 * progress;


            heroBracketLeft.style.transform =
                `translate(${moveX}px, ${moveY}px)`;


            heroBracketRight.style.transform =
                `translate(${-moveX}px, ${-moveY}px)`;

        }


        registerScrollModule(
            updateHeroBracketPosition
        );


        updateHeroBracketPosition(
            state.scrollY
        );

    }


    /* =====================================================
       05. HERO RESPONSIVE

       目前 Desktop / Mobile：

       center center

       保留原本 V7 function，
       未來需要不同裁切時可直接修改。
       ===================================================== */

    function initHeroResponsive() {

        const heroImage =
            document.querySelector(
                ".hero-image"
            );


        if (!heroImage) {

            return;

        }


        function responsiveHero() {

            heroImage.style.objectPosition =
                "center center";

        }


        responsiveHero();


        window.addEventListener(
            "resize",
            responsiveHero
        );

    }


    /* =====================================================
       06. SELECTED WORKS CONFIG
       ===================================================== */

    const WORK_ROTATION_CONFIG = {

        /*
            可選：

            "daily"
            "weekly"
            "monthly"
        */

        mode: "monthly",


        /*
            正式輪播起始日期
        */

        startDate: "2026-10-01",


        /*
            A → B → C → D → E → F → G → H
        */

        sets: [

            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H"

        ],


        /*
            測試：

            "A"～"H"
            = 強制顯示指定組別

            null
            = 啟用正式日期輪播
        */

        testSet: "null"

    };


    /* =====================================================
       07. SELECTED WORKS DATA
       ===================================================== */

    const WORK_DATA = {

        A: {

            quotes: [

                "光與人物之間留下的關係",

                "光線在人物身上留下的，不只是明暗",

                "被選擇留下的，才成為畫面",

                "有些情緒，是在快門之後才開始發生",

                "看見一個人之前，先決定如何靠近他",

                "光與人物之間，總有一段沒有被說出的距離"

            ]

        },


        B: {

            quotes: [

                "B 組金句 01",
                "B 組金句 02",
                "B 組金句 03",
                "B 組金句 04",
                "B 組金句 05",
                "B 組金句 06"

            ]

        },


        C: {

            quotes: [

                "C 組金句 01",
                "C 組金句 02",
                "C 組金句 03",
                "C 組金句 04",
                "C 組金句 05",
                "C 組金句 06"

            ]

        },


        D: {

            quotes: [

                "D 組金句 01",
                "D 組金句 02",
                "D 組金句 03",
                "D 組金句 04",
                "D 組金句 05",
                "D 組金句 06"

            ]

        },


        E: {

            quotes: [

                "E 組金句 01",
                "E 組金句 02",
                "E 組金句 03",
                "E 組金句 04",
                "E 組金句 05",
                "E 組金句 06"

            ]

        },


        F: {

            quotes: [

                "F 組金句 01",
                "F 組金句 02",
                "F 組金句 03",
                "F 組金句 04",
                "F 組金句 05",
                "F 組金句 06"

            ]

        },


        G: {

            quotes: [

                "G 組金句 01",
                "G 組金句 02",
                "G 組金句 03",
                "G 組金句 04",
                "G 組金句 05",
                "G 組金句 06"

            ]

        },


        H: {

            quotes: [

                "H 組金句 01",
                "H 組金句 02",
                "H 組金句 03",
                "H 組金句 04",
                "H 組金句 05",
                "H 組金句 06"

            ]

        }

    };


    /* =====================================================
       08. SELECTED WORKS ROTATION
       ===================================================== */

    function getCurrentWorkSet() {

        /*
            -------------------------
            測試模式
            -------------------------
        */

        if (
            WORK_ROTATION_CONFIG.testSet &&
            WORK_DATA[
                WORK_ROTATION_CONFIG.testSet
            ]
        ) {

            return WORK_ROTATION_CONFIG.testSet;

        }


        /*
            -------------------------
            日期
            -------------------------
        */

        const today =
            new Date();


        const startDate =
            new Date(
                WORK_ROTATION_CONFIG.startDate +
                "T00:00:00"
            );


        /*
            如果起始日期未來，
            暫時使用 A，
            避免出現負 index。
        */

        if (
            today.getTime() <
            startDate.getTime()
        ) {

            return (
                WORK_ROTATION_CONFIG.sets[0]
            );

        }


        const millisecondsPerDay =
            1000 *
            60 *
            60 *
            24;


        const elapsedDays =
            Math.floor(
                (
                    today -
                    startDate
                ) /
                millisecondsPerDay
            );


        let cycleIndex = 0;


        /*
            -------------------------
            Daily
            -------------------------
        */

        if (
            WORK_ROTATION_CONFIG.mode ===
            "daily"
        ) {

            cycleIndex =
                elapsedDays;

        }


        /*
            -------------------------
            Weekly
            -------------------------
        */

        else if (
            WORK_ROTATION_CONFIG.mode ===
            "weekly"
        ) {

            cycleIndex =
                Math.floor(
                    elapsedDays / 7
                );

        }


        /*
            -------------------------
            Monthly
            -------------------------
        */

        else {

            const startYear =
                startDate.getFullYear();

            const startMonth =
                startDate.getMonth();


            const currentYear =
                today.getFullYear();

            const currentMonth =
                today.getMonth();


            cycleIndex =
                (
                    (
                        currentYear -
                        startYear
                    ) * 12
                )
                +
                (
                    currentMonth -
                    startMonth
                );

        }


        /*
            -------------------------
            A → H 循環
            -------------------------
        */

        const setCount =
            WORK_ROTATION_CONFIG
                .sets
                .length;


        if (!setCount) {

            return "A";

        }


        const setIndex =
            (
                cycleIndex %
                setCount +
                setCount
            ) %
            setCount;


        return (
            WORK_ROTATION_CONFIG
                .sets[setIndex]
        );

    }


    /* =====================================================
       09. SELECTED WORKS
           BRIGHTNESS DETECTION
       ===================================================== */

    function detectWorkBrightness(
        img,
        hoverElement
    ) {

        if (
            !img ||
            !hoverElement ||
            !img.complete ||
            !img.naturalWidth
        ) {

            return;

        }


        /*
            每次建立 40 × 40 canvas
            進行快速平均亮度分析。
        */

        const canvas =
            document.createElement(
                "canvas"
            );


        const ctx =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );


        if (!ctx) {

            return;

        }


        canvas.width = 40;
        canvas.height = 40;


        try {

            ctx.drawImage(
                img,
                0,
                0,
                40,
                40
            );


            const data =
                ctx.getImageData(
                    0,
                    0,
                    40,
                    40
                ).data;


            let brightness = 0;


            for (
                let i = 0;
                i < data.length;
                i += 4
            ) {

                brightness +=
                    (
                        data[i] *
                        0.299
                    )
                    +
                    (
                        data[i + 1] *
                        0.587
                    )
                    +
                    (
                        data[i + 2] *
                        0.114
                    );

            }


            brightness =
                brightness /
                (
                    data.length / 4
                );


            /*
                亮圖：
                .light-image

                暗圖：
                移除 .light-image
            */

            hoverElement.classList.toggle(
                "light-image",
                brightness > 150
            );

        } catch (error) {

            /*
                如果圖片來自不同來源，
                canvas 可能發生 SecurityError。

                不讓這個錯誤中斷整支 JS。
            */

            console.warn(
                "Selected Works brightness detection failed:",
                error
            );

        }

    }


    /* =====================================================
       10. SELECTED WORKS
           LOAD WORK SET
       ===================================================== */

    function updateWorkBrightness(
        img,
        hoverElement
    ) {

        if (
            !img ||
            !hoverElement
        ) {

            return;

        }


        /*
            如果圖片尚未載入，
            綁定一次 load。

            使用 onload 不累積多個 listener。
        */

        const runDetection =
            () => {

                detectWorkBrightness(
                    img,
                    hoverElement
                );

            };


        if (
            img.complete &&
            img.naturalWidth
        ) {

            runDetection();

        } else {

            img.addEventListener(
                "load",
                runDetection,
                {
                    once: true
                }
            );

        }

    }


    function loadWorkSet(set) {

        const data =
            WORK_DATA[set];


        if (!data) {

            console.warn(
                `Selected Works: 找不到 ${set} 組資料`
            );

            return;

        }


        const workItems =
            document.querySelectorAll(
                ".work-item"
            );


        /*
            HTML 沒有 Selected Works
            直接結束。
        */

        if (!workItems.length) {

            return;

        }


        workItems.forEach(
            (item, index) => {

                const img =
                    item.querySelector(
                        ".work-image"
                    );


                const hoverText =
                    item.querySelector(
                        ".work-hover-text"
                    );


                const hoverElement =
                    item.querySelector(
                        ".work-hover"
                    );


                if (
                    !img ||
                    !hoverText ||
                    !hoverElement
                ) {

                    return;

                }


                /*
                    01 ～ 06
                */

                const number =
                    String(
                        index + 1
                    ).padStart(
                        2,
                        "0"
                    );


                /*
                    -------------------------
                    更新圖片
                    -------------------------
                */

                const newSrc =
                    `images/${set}-work${number}.jpg`;


                /*
                    如果圖片已經是相同來源，
                    不重新設定。
                */

                if (
                    !img.src.endsWith(
                        newSrc
                    )
                ) {

                    img.src =
                        newSrc;

                }


                /*
                    -------------------------
                    更新 ALT
                    -------------------------
                */

                img.alt =
                    `Selected Work ${number}`;


                /*
                    -------------------------
                    更新金句
                    -------------------------
                */

                hoverText.textContent =
                    data.quotes[index] || "";


                /*
                    -------------------------
                    重新偵測明暗
                    -------------------------
                */

                updateWorkBrightness(
                    img,
                    hoverElement
                );

            }
        );


        /*
            -------------------------
            更新 data-work-set
            -------------------------
        */

        const grid =
            document.querySelector(
                ".works-grid"
            );


        if (grid) {

            grid.dataset.workSet =
                set;

        }

    }


    function initSelectedWorks() {

        const worksGrid =
            document.querySelector(
                ".works-grid"
            );


        if (!worksGrid) {

            return;

        }


        const currentSet =
            getCurrentWorkSet();


        loadWorkSet(
            currentSet
        );

    }

    /*當滑鼠點圖片不作用*/
    document.querySelectorAll(".work-link").forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
    });
});

    /* =====================================================
       11. CASE STUDY
           MOBILE 3 DOTS

       原本功能完整保留。

       Desktop：
       不需要特別處理。

       Mobile：
       scroll → 自動判斷目前 card
       dot click → smooth scroll
       ===================================================== */

    function initCaseStudyDots() {

        const caseScroller =
            document.querySelector(
                ".case-study-scroller"
            );


        const caseCards =
            document.querySelectorAll(
                ".case-card"
            );


        const caseDots =
            document.querySelectorAll(
                ".case-study-dot"
            );


        /*
            只有 HTML 同時存在：

            scroller
            3 cards
            3 dots

            才啟用。
        */

        if (
            !caseScroller ||
            caseCards.length !== 3 ||
            caseDots.length !== 3
        ) {

            return;

        }


        /*
            -------------------------
            判斷目前 active dot
            -------------------------
        */

        function updateCaseDot() {

            /*
                如果目前不是 horizontal
                scrolling 狀態，
                仍然可以安全計算。
            */

            const scrollerRect =
                caseScroller.getBoundingClientRect();


            const viewportCenter =
                scrollerRect.left +
                scrollerRect.width / 2;


            let activeIndex = 0;


            let closestDistance =
                Infinity;


            caseCards.forEach(
                (card, index) => {

                    const cardRect =
                        card.getBoundingClientRect();


                    const cardCenter =
                        cardRect.left +
                        cardRect.width / 2;


                    const distance =
                        Math.abs(
                            cardCenter -
                            viewportCenter
                        );


                    if (
                        distance <
                        closestDistance
                    ) {

                        closestDistance =
                            distance;

                        activeIndex =
                            index;

                    }

                }
            );


            caseDots.forEach(
                (dot, index) => {

                    dot.classList.toggle(
                        "is-active",
                        index === activeIndex
                    );

                }
            );

        }


        /*
            -------------------------
            Scroll
            -------------------------

            Case Study 自己的 horizontal
            scroll 不等於 window scroll，

            所以保留自己的 listener。
        */

        caseScroller.addEventListener(
            "scroll",
            updateCaseDot,
            {
                passive: true
            }
        );


        /*
            -------------------------
            Dot click
            -------------------------
        */

        caseDots.forEach(
            (dot, index) => {

                dot.addEventListener(
                    "click",
                    () => {

                        const card =
                            caseCards[index];


                        if (!card) {

                            return;

                        }


                        const scrollerRect =
                            caseScroller
                                .getBoundingClientRect();


                        const cardRect =
                            card.getBoundingClientRect();


                        const currentScroll =
                            caseScroller.scrollLeft;


                        const cardCenter =
                            cardRect.left +
                            cardRect.width / 2;


                        const viewportCenter =
                            scrollerRect.left +
                            scrollerRect.width / 2;


                        const targetScroll =
                            currentScroll +
                            (
                                cardCenter -
                                viewportCenter
                            );


                        caseScroller.scrollTo({

                            left:
                                targetScroll,

                            behavior:
                                state.prefersReducedMotion
                                    ? "auto"
                                    : "smooth"

                        });

                    }
                );

            }
        );


        /*
            初始狀態
        */

        updateCaseDot();


        /*
            Resize 後重新計算。
        */

        window.addEventListener(
            "resize",
            updateCaseDot
        );

    }


    /* =====================================================
   12 MOBILE MENU V7.2
    -----------------------------------------------------
   功能：
   1. 點擊漢堡按鈕 → 開啟選單
   2. 再點一次 → 關閉選單
   3. 點擊導覽項目 → 關閉選單
   4. 點擊選單外部 → 關閉選單
   5. ESC → 關閉選單
   6. aria-expanded 同步更新
   7. body 鎖定，避免背景跟著滾動
    ===================================================== */
function initMobileMenu() {

    const mobileMenuToggle = document.querySelector(
    ".mobile-menu-toggle"
    );

    const primaryNavigation = document.querySelector(
    ".primary-navigation"
    );

    const primaryNavigationLinks = document.querySelectorAll(
    ".primary-navigation a"
    );

    const headerCourseCTA = document.querySelector(
    ".header-course-cta"
    );


    if (
    mobileMenuToggle &&
    primaryNavigation
    ) {

    /* =================================================
       OPEN
       ================================================= */

    function openMobileMenu() {

        primaryNavigation.classList.add("active");

        mobileMenuToggle.classList.add("is-active");

        mobileMenuToggle.setAttribute(
            "aria-expanded",
            "true"
        );

        mobileMenuToggle.setAttribute(
            "aria-label",
            "關閉網站選單"
        );

        document.body.classList.add(
            "mobile-menu-open"
        );

    }


    /* =================================================
       CLOSE
       ================================================= */

    function closeMobileMenu() {

        primaryNavigation.classList.remove("active");

        mobileMenuToggle.classList.remove("is-active");

        mobileMenuToggle.setAttribute(
            "aria-expanded",
            "false"
        );

        mobileMenuToggle.setAttribute(
            "aria-label",
            "開啟網站選單"
        );

        document.body.classList.remove(
            "mobile-menu-open"
        );

    }


    /* =================================================
       TOGGLE
       ================================================= */

    function toggleMobileMenu() {

        if (
            primaryNavigation.classList.contains(
                "active"
            )
        ) {

            closeMobileMenu();

        } else {

            openMobileMenu();

        }

    }


    /* =================================================
       HAMBURGER / X BUTTON
       ================================================= */

    mobileMenuToggle.addEventListener(
        "click",
        toggleMobileMenu
    );


    /* =================================================
       MENU NAVIGATION
       -------------------------------------------------
       所有選單連結點擊後：
       1. 關閉 Menu
       2. 讓原本 anchor 正常跳轉
       ================================================= */

    primaryNavigationLinks.forEach(
        (link) => {

            link.addEventListener(
                "click",
                () => {

                    closeMobileMenu();

                }
            );

        }
    );


    /* =================================================
       HEADER「探索課程」
       -------------------------------------------------
       它不在 primary-navigation 裡，
       所以獨立處理。
       ================================================= */

    if (headerCourseCTA) {

        headerCourseCTA.addEventListener(
            "click",
            () => {

                closeMobileMenu();

            }
        );

    }


    /* =================================================
       ESC
       ================================================= */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                primaryNavigation.classList.contains(
                    "active"
                )
            ) {

                closeMobileMenu();

                mobileMenuToggle.focus();

            }

        }
    );


    /* =================================================
       點擊 MENU 背景
       -------------------------------------------------
       點黑色背景本身可以關閉。
       點文字 / link 不會觸發這裡。
       ================================================= */

    primaryNavigation.addEventListener(
        "click",
        (event) => {

            if (
                event.target === primaryNavigation
            ) {

                closeMobileMenu();

            }

        }
    );


    /* =================================================
       RESPONSIVE
       -------------------------------------------------
       回到 Desktop 時自動關閉 Menu
       ================================================= */

    function handleMenuResize() {

        if (
            window.innerWidth > 767
        ) {

            closeMobileMenu();

        }

    }


    window.addEventListener(
        "resize",
        handleMenuResize
    );


    /* =================================================
       INITIAL STATE
       ================================================= */

    closeMobileMenu();

}

}


/* =====================================================
   13. SECTION MOTION
   Selected Works、Final CTA、Footer 不動畫

   Learning Path：
   - Desktop：節奏較慢
   - Tablet：維持目前節奏
   - Mobile：卡片與圖片快；標題與線維持 Tablet 速度
   ===================================================== */

function initSectionReveal() {

    const isMobile =
        window.innerWidth <= 767;

    const isDesktop =
        window.innerWidth >= 1000;

    const learningTiming = isMobile
        ? {
            title: 40,
            cards: [70, 115, 160],
            images: [85, 135, 185]
        }
        : isDesktop
            ? {
                title: 120,
                cards: [260, 380, 500],
                images: [320, 470, 620]
            }
            : {
                title: 40,
                cards: [150, 230, 310],
                images: [190, 290, 390]
            };

    const revealStyle = document.createElement("style");

    revealStyle.textContent = `
        .jg-text-reveal,
        .jg-learning-title,
        .jg-card-soft,
        .jg-image-reveal {
            transition-delay: var(--jg-delay, 0ms);
            will-change: opacity, transform;
        }

        /* Learning Title：
           Tablet 與 Mobile 使用相同的出現速度 */
        .jg-learning-title {
            opacity: 0;
            transform: translate3d(0, 16px, 0);
            transition:
                opacity 480ms cubic-bezier(.22, .61, .36, 1),
                transform 580ms cubic-bezier(.22, .61, .36, 1);
        }

        .jg-learning-title.jg-reveal-visible {
            opacity: 1;
            transform: translate3d(0, 0, 0);
        }

        /* Case / About 文字：維持目前版本 */
        .jg-text-reveal {
            opacity: 0;
            transform: translate3d(0, 16px, 0);
            transition:
                opacity 650ms cubic-bezier(.22, .61, .36, 1),
                transform 760ms cubic-bezier(.22, .61, .36, 1);
        }

        .jg-text-reveal.jg-reveal-visible {
            opacity: 1;
            transform: translate3d(0, 0, 0);
        }

        /* Learning Card：opacity 0 → 1，加上跟其他 reveal 一致的位移 */
        .jg-card-soft {
            opacity: 0;
            transform: translate3d(0, 16px, 0);
            transition:
                opacity 520ms cubic-bezier(.22, .61, .36, 1),
                transform 620ms cubic-bezier(.22, .61, .36, 1);
        }

        .jg-card-soft.jg-reveal-visible {
            opacity: 1;
            transform: translate3d(0, 0, 0);
        }

        /* Learning / Case / About 圖片 */
        .jg-image-reveal {
            opacity: 0;
            transform: scale(1.04);
            transition:
                opacity 850ms cubic-bezier(.22, .61, .36, 1),
                transform 1200ms cubic-bezier(.22, .61, .36, 1);
        }

        .jg-image-reveal.jg-reveal-visible {
            opacity: 1;
            transform: scale(1);
        }

        .jg-course-image-frame {
            display: block;
            overflow: hidden;
            border-radius: 4px;
        }

        /* Desktop：Learning 節奏更慢 */
        @media (min-width: 1000px) {
            .jg-learning-title {
                transition:
                    opacity 650ms cubic-bezier(.22, .61, .36, 1),
                    transform 780ms cubic-bezier(.22, .61, .36, 1);
            }

            .jg-card-soft {
                transition:
                    opacity 700ms cubic-bezier(.22, .61, .36, 1);
            }

            .learning-path-courses .jg-image-reveal {
                transition:
                    opacity 1000ms cubic-bezier(.22, .61, .36, 1),
                    transform 1400ms cubic-bezier(.22, .61, .36, 1);
            }
        }

        /* Tablet / Mobile：
           標題旁線由左側延伸 */
        @media (max-width: 999px) {
            .learning-path-title.jg-learning-title::after {
                transform: scaleX(0);
                transform-origin: left center;
                transition:
                    transform 650ms cubic-bezier(.22, .61, .36, 1);
                transition-delay: 150ms;
            }

            .learning-path-title.jg-learning-title.jg-reveal-visible::after {
                transform: scaleX(1);
            }
        }

        /* Mobile：
           卡片與圖片維持較快節奏；
           Title 與線不覆蓋，因此使用 Tablet 速度 */
        @media (max-width: 767px) {
            .jg-card-soft {
                transition:
                    opacity 350ms cubic-bezier(.22, .61, .36, 1);
            }

            .learning-path-courses .jg-image-reveal {
                transition:
                    opacity 480ms cubic-bezier(.22, .61, .36, 1),
                    transform 650ms cubic-bezier(.22, .61, .36, 1);
            }
        }
    `;

    document.head.appendChild(revealStyle);


    function prepare(
        element,
        className,
        delay
    ) {

        if (!element) {
            return null;
        }

        element.classList.add(className);

        element.style.setProperty(
            "--jg-delay",
            `${delay}ms`
        );

        return element;

    }


    function prepareMany(
        selector,
        className,
        delays
    ) {

        return Array.from(
            document.querySelectorAll(selector)
        )
            .map((element, index) => {

                return prepare(
                    element,
                    className,
                    delays[index] || 0
                );

            })
            .filter(Boolean);

    }


    const learningSection = document.querySelector(
        ".learning-path"
    );

    const learningTargets = [

        prepare(
            document.querySelector(
                ".learning-path-title"
            ),
            "jg-learning-title",
            learningTiming.title
        ),

        ...prepareMany(
            ".learning-path-courses .course-card",
            "jg-card-soft",
            learningTiming.cards
        ),

        ...prepareMany(
            ".learning-path-courses .course-image-link",
            "jg-course-image-frame",
            [0, 0, 0]
        ),

        ...prepareMany(
            ".learning-path-courses .course-image",
            "jg-image-reveal",
            learningTiming.images
        )

    ].filter(Boolean);


    /* Case Study：保留目前版本 */

    const caseStudyInner = document.querySelector(
        ".case-study-inner"
    );

    const caseStudyTargets = [

        prepare(
            document.querySelector(
                ".case-study-title"
            ),
            "jg-text-reveal",
            110
        ),

        ...prepareMany(
            ".case-card .case-image",
            "jg-image-reveal",
            [290, 440, 590]
        )

    ].filter(Boolean);


    /* About James：保留目前版本 */

    const aboutJamesInner = document.querySelector(
        ".about-james-inner"
    );

    const aboutTargets = [

        prepare(
            document.querySelector(
                ".about-james-image"
            ),
            "jg-image-reveal",
            0
        ),

        prepare(
            document.querySelector(
                ".about-james-content"
            ),
            "jg-text-reveal",
            110
        )

    ].filter(Boolean);


    const groups = [

        {
            trigger: learningSection,
            targets: learningTargets
        },

        {
            trigger: caseStudyInner,
            targets: caseStudyTargets
        },

        {
            trigger: aboutJamesInner,
            targets: aboutTargets
        }

    ].filter((group) => {
        return (
            group.trigger &&
            group.targets.length
        );
    });


    requestAnimationFrame(() => {

        requestAnimationFrame(() => {

            function revealEntries(
                entries,
                currentObserver
            ) {

                entries.forEach((entry) => {

                    if (!entry.isIntersecting) {
                        return;
                    }

                    const group = groups.find((item) => {
                        return (
                            item.trigger ===
                            entry.target
                        );
                    });

                    if (!group) {
                        return;
                    }

                    group.targets.forEach((target) => {
                        target.classList.add(
                            "jg-reveal-visible"
                        );
                    });

                    currentObserver.unobserve(
                        entry.target
                    );

                });

            }


            const standardObserver =
                new IntersectionObserver(
                    revealEntries,
                    {
                        threshold: 0.1,
                        rootMargin: "0px 0px -10% 0px"
                    }
                );


            const learningMobileObserver =
                new IntersectionObserver(
                    revealEntries,
                    {
                        threshold: 0.01,
                        rootMargin: "0px 0px 35% 0px"
                    }
                );


            groups.forEach((group) => {

                const useMobileLearningTrigger =
                    isMobile &&
                    group.trigger === learningSection;

                if (useMobileLearningTrigger) {

                    learningMobileObserver.observe(
                        group.trigger
                    );

                } else {

                    standardObserver.observe(
                        group.trigger
                    );

                }

            });

        });

    });

}


/* =====================================================
   14. INITIALIZATION
   ===================================================== */

initHeader();

initHero();

initHeroResponsive();

initSelectedWorks();

initCaseStudyDots();

initSectionReveal();

initMobileMenu();

updateScrollEffects();


/* =====================================================
   Learning Path Mobile
   改用與 Case Study Mobile 相同節奏
   ===================================================== */

const learningMobilePacingStyle =
    document.createElement("style");

learningMobilePacingStyle.textContent = `
    @media (max-width: 767px) {

        /* Title：與 Case Study Title 相同速度 */
        .learning-path-title.jg-learning-title {
            transition:
                opacity 650ms cubic-bezier(.22, .61, .36, 1) !important,
                transform 760ms cubic-bezier(.22, .61, .36, 1) !important;
            transition-delay: 110ms !important;
        }

        /* Title 旁線：跟在標題後面慢慢延伸 */
        .learning-path-title.jg-learning-title::after {
            transition:
                transform 760ms cubic-bezier(.22, .61, .36, 1) !important;
            transition-delay: 230ms !important;
        }

        /* 三張 Card：維持 0.5 → 1，但節奏放慢 */
        .learning-path-courses .jg-card-soft {
            transition:
                opacity 650ms cubic-bezier(.22, .61, .36, 1) !important;
        }

        .learning-path-courses .course-card:nth-child(1) {
            transition-delay: 200ms !important;
        }

        .learning-path-courses .course-card:nth-child(2) {
            transition-delay: 330ms !important;
        }

        .learning-path-courses .course-card:nth-child(3) {
            transition-delay: 460ms !important;
        }

        /* 三張圖：完全比照 Case Study 圖片的速度與節奏 */
        .learning-path-courses .jg-image-reveal {
            transition:
                opacity 850ms cubic-bezier(.22, .61, .36, 1) !important,
                transform 1200ms cubic-bezier(.22, .61, .36, 1) !important;
        }

        .learning-path-courses .course-card:nth-child(1)
        .jg-image-reveal {
            transition-delay: 290ms !important;
        }

        .learning-path-courses .course-card:nth-child(2)
        .jg-image-reveal {
            transition-delay: 440ms !important;
        }

        .learning-path-courses .course-card:nth-child(3)
        .jg-image-reveal {
            transition-delay: 590ms !important;
        }
    }
`;

document.head.appendChild(
    learningMobilePacingStyle
);



});