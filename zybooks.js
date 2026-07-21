// ==UserScript==
// @name         zyBooks Helper
// @namespace    fuenzy.zybooks.helper
// @version      1.0
// @description  Starts and runs animations at 2x speed and detects answer results.
// @match        https://learn.zybooks.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// College is fucking gay!!!!!


(() => {
    const CONFIG = {
        initialDelay: 1000,
        scanInterval: 900,

        clickDelay: 350,
        answerDelay: 450,
        dragDelay: 450,

        controlsTimeout: 10000,
        stepTimeout: 60000,
        answerResultTimeout: 7000,
        shortAnswerRevealTimeout: 7000,
        matchResultTimeout: 6000,
        stablePlacementTime: 1800,

        betweenAnimationsDelay: 500,
        betweenQuestionsDelay: 650,
        betweenShortAnswersDelay: 650,
        betweenTermsDelay: 600,
        betweenBucketsDelay: 500,

        maxAnimationSteps: 50,
        maxAnswerAttempts: 20,
        maxShortAnswerRevealClicks: 2,
        maxMatchingPasses: 100
    };

    let helperEnabled = true;
    let runnerBusy = false;
    let runQueued = false;
    let mutationScanTimer = null;

    const clickedRenderButtons = new WeakSet();

    const finishedAnimations = new WeakSet();
    const runningAnimations = new WeakSet();

    const completedQuestions = new WeakSet();
    const runningQuestions = new WeakSet();

    const completedShortAnswers = new WeakSet();
    const runningShortAnswers = new WeakSet();

    const completedMatchingActivities = new WeakSet();
    const runningMatchingActivities = new WeakSet();

    function sleep(milliseconds) {
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    function normalizeText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isVisible(element) {
        if (!element) {
            return false;
        }

        const style = getComputedStyle(element);

        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            element.getClientRects().length > 0
        );
    }

    function isDisabled(element) {
        return (
            !element ||
            element.disabled ||
            element.classList.contains("disabled") ||
            element.getAttribute("aria-disabled") === "true"
        );
    }

    async function waitForCondition(
        condition,
        timeout = 5000,
        interval = 100
    ) {
        const startedAt = Date.now();

        while (
            helperEnabled &&
            Date.now() - startedAt < timeout
        ) {
            try {
                const result = condition();

                if (result) {
                    return result;
                }
            } catch (error) {
                console.error(
                    "[Local Activity Tester] Condition error:",
                    error
                );
            }

            await sleep(interval);
        }

        return null;
    }

    function log(message, details = "") {
        console.log(
            `[Local Activity Tester] ${message}`,
            details
        );

        const status = document.querySelector(
            "#local-tester-status"
        );

        const detailBox = document.querySelector(
            "#local-tester-details"
        );

        if (status) {
            status.textContent = message;
        }

        if (detailBox) {
            detailBox.textContent = details;
        }
    }

    function createPanel() {
        if (document.querySelector("#local-tester-panel")) {
            return;
        }

        const panel = document.createElement("div");
        panel.id = "local-tester-panel";

        Object.assign(panel.style, {
            position: "fixed",
            right: "18px",
            bottom: "18px",
            width: "350px",
            padding: "14px",
            borderRadius: "10px",
            background: "rgba(24, 24, 30, 0.97)",
            color: "#fff",
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            lineHeight: "1.4",
            boxShadow: "0 8px 28px rgba(0, 0, 0, 0.4)",
            zIndex: "2147483647"
        });

        panel.innerHTML = `
            <div style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                margin-bottom:8px;
            ">
                <strong style="font-size:15px;">
                    Local Activity Tester
                </strong>

                <span id="local-tester-dot" style="
                    width:9px;
                    height:9px;
                    display:block;
                    border-radius:50%;
                    background:#52c46b;
                "></span>
            </div>

            <div id="local-tester-status">
                Loading...
            </div>

            <div id="local-tester-details" style="
                min-height:35px;
                margin-top:5px;
                opacity:0.75;
                font-size:12px;
            ">
                Waiting for local activities.
            </div>

            <div style="
                display:grid;
                grid-template-columns:repeat(4, 1fr);
                gap:6px;
                margin-top:10px;
                padding:8px;
                border-radius:6px;
                background:rgba(255,255,255,0.07);
                font-size:12px;
            ">
                <div>
                    Animations<br>
                    <strong id="local-tester-animation-count">0/0</strong>
                </div>

                <div>
                    Questions<br>
                    <strong id="local-tester-question-count">0/0</strong>
                </div>

                <div>
                    Short<br>
                    <strong id="local-tester-short-answer-count">0/0</strong>
                </div>

                <div>
                    Matching<br>
                    <strong id="local-tester-match-count">0/0</strong>
                </div>
            </div>

            <div style="
                display:flex;
                gap:7px;
                margin-top:11px;
            ">
                <button id="local-tester-run" style="
                    flex:1;
                    border:0;
                    border-radius:6px;
                    padding:8px;
                    cursor:pointer;
                    font-weight:bold;
                ">
                    Run all
                </button>

                <button id="local-tester-toggle" style="
                    flex:1;
                    border:0;
                    border-radius:6px;
                    padding:8px;
                    cursor:pointer;
                ">
                    Pause
                </button>
            </div>
        `;

        document.body.appendChild(panel);

        document
            .querySelector("#local-tester-run")
            .addEventListener("click", () => {
                queueRun(true);
            });

        document
            .querySelector("#local-tester-toggle")
            .addEventListener("click", toggleHelper);
    }

    function toggleHelper() {
        helperEnabled = !helperEnabled;

        const button = document.querySelector(
            "#local-tester-toggle"
        );

        const dot = document.querySelector(
            "#local-tester-dot"
        );

        if (button) {
            button.textContent = helperEnabled
                ? "Pause"
                : "Resume";
        }

        if (dot) {
            dot.style.background = helperEnabled
                ? "#52c46b"
                : "#d45a5a";
        }

        if (helperEnabled) {
            log(
                "Tester resumed.",
                "Scanning all supported activity types."
            );

            scanPage();
        } else {
            log(
                "Tester paused.",
                "Current operations will stop safely."
            );
        }
    }

    function getActivityTitle(activity, fallback) {
        return (
            normalizeText(
                activity.querySelector(".activity-title")
                    ?.textContent
            ) ||
            `Activity ${fallback + 1}`
        );
    }

    /*
     * =====================================================
     * RENDER WEBPAGE BUTTONS
     * =====================================================
     */

    function getRenderWebpageButtons() {
        return [
            ...document.querySelectorAll(
                "button.render-webpage"
            )
        ].filter(button => {
            return (
                normalizeText(button.textContent)
                    .toLowerCase() === "render webpage"
            );
        });
    }

    async function clickAllRenderWebpageButtons() {
        const buttons = getRenderWebpageButtons();

        for (const button of buttons) {
            if (!helperEnabled) {
                return;
            }

            if (
                clickedRenderButtons.has(button) ||
                isDisabled(button)
            ) {
                continue;
            }

            clickedRenderButtons.add(button);

            log(
                "Rendering webpage preview.",
                "Clicked a Render webpage button."
            );

            button.click();
            await sleep(CONFIG.clickDelay);
        }
    }

    /*
     * =====================================================
     * COUNTERS
     * =====================================================
     */

    function isMatchingActivityComplete(activity) {
        const bank = getTermBank(activity);
        const buckets = getMatchBuckets(activity);

        if (!bank || buckets.length === 0) {
            return false;
        }

        const bankTerms = getDirectTerms(bank);

        return (
            bankTerms.length === 0 &&
            buckets.every(bucket => {
                return Boolean(
                    getDirectTerms(bucket)[0]
                );
            })
        );
    }

    function updateCounters() {
        const animations = getAnimationActivities();
        const questions = getMultipleChoiceQuestions();
        const shortAnswers = getShortAnswerQuestions();
        const matches = getMatchingActivities();

        const animationFinished = animations.filter(activity => {
            return finishedAnimations.has(activity);
        }).length;

        const questionFinished = questions.filter(question => {
            return (
                completedQuestions.has(question) ||
                getQuestionResult(question) === "correct"
            );
        }).length;

        const shortAnswerFinished = shortAnswers.filter(question => {
            return (
                completedShortAnswers.has(question) ||
                getQuestionResult(question) === "correct"
            );
        }).length;

        const matchingFinished = matches.filter(activity => {
            return (
                completedMatchingActivities.has(activity) ||
                isMatchingActivityComplete(activity)
            );
        }).length;

        const animationCounter = document.querySelector(
            "#local-tester-animation-count"
        );

        const questionCounter = document.querySelector(
            "#local-tester-question-count"
        );

        const shortAnswerCounter = document.querySelector(
            "#local-tester-short-answer-count"
        );

        const matchingCounter = document.querySelector(
            "#local-tester-match-count"
        );

        if (animationCounter) {
            animationCounter.textContent =
                `${animationFinished}/${animations.length}`;
        }

        if (questionCounter) {
            questionCounter.textContent =
                `${questionFinished}/${questions.length}`;
        }

        if (shortAnswerCounter) {
            shortAnswerCounter.textContent =
                `${shortAnswerFinished}/${shortAnswers.length}`;
        }

        if (matchingCounter) {
            matchingCounter.textContent =
                `${matchingFinished}/${matches.length}`;
        }
    }

    /*
     * =====================================================
     * ANIMATIONS
     * =====================================================
     */

    function getAnimationActivities() {
        const activities = [
            ...document.querySelectorAll(
                ".interactive-activity-container"
            )
        ].filter(activity => {
            return Boolean(
                activity.querySelector(".animation-canvas") ||
                activity.querySelector(".animation-controls") ||
                activity.querySelector("button.start-button")
            );
        });

        if (activities.length > 0) {
            return activities;
        }

        return [
            ...document.querySelectorAll(
                ".animation-player-content-resource"
            )
        ].filter((activity, index, all) => {
            return !all.some(other => {
                return (
                    other !== activity &&
                    other.contains(activity)
                );
            });
        });
    }

    function findAnimationControls(activity) {
        const controls = [
            ...activity.querySelectorAll(".animation-controls")
        ];

        return (
            controls.find(isVisible) ||
            controls[0] ||
            null
        );
    }

    function findAnimationStartButton(activity) {
        return (
            activity.querySelector(
                'button.start-button[aria-label="Start"]'
            ) ||
            [...activity.querySelectorAll("button.start-button")]
                .find(button => {
                    return (
                        normalizeText(button.textContent)
                            .toLowerCase() === "start"
                    );
                }) ||
            null
        );
    }

    function getAnimationSteps(activity, controls) {
        const scope = controls || activity;

        return [
            ...scope.querySelectorAll("button.step")
        ].filter(button => {
            return Boolean(
                button.querySelector(".title") ||
                normalizeText(button.textContent)
            );
        });
    }

    function getStepNumber(button) {
        return (
            normalizeText(
                button?.querySelector(".title")?.textContent
            ) ||
            normalizeText(button?.textContent) ||
            "?"
        );
    }

    function getHighlightedStep(activity, controls) {
        return (
            controls.querySelector(
                "button.step.step-highlight"
            ) ||
            activity.querySelector(
                "button.step.step-highlight"
            ) ||
            controls.querySelector(
                'button.step[aria-current="true"]'
            ) ||
            null
        );
    }

    function findPlayButton(activity, controls) {
        return (
            controls.querySelector(
                'button[aria-label="Play"]'
            ) ||
            activity.querySelector(
                'button[aria-label="Play"]'
            ) ||
            [...controls.querySelectorAll(
                "button.normalize-controls"
            )].find(button => {
                return Boolean(
                    button.querySelector(".play-button")
                );
            }) ||
            null
        );
    }

    function isAnimationPlaying(activity, controls) {
        const pauseButton =
            controls.querySelector(
                'button[aria-label="Pause"]'
            ) ||
            activity.querySelector(
                'button[aria-label="Pause"]'
            );

        if (pauseButton && isVisible(pauseButton)) {
            return true;
        }

        const graphic = controls.querySelector(
            ".play-button"
        );

        return Boolean(
            graphic &&
            (
                graphic.classList.contains("pause") ||
                graphic.classList.contains("playing")
            )
        );
    }

    async function openAnimation(activity, title) {
        let controls = findAnimationControls(activity);

        if (
            controls &&
            getAnimationSteps(activity, controls).length > 0
        ) {
            return controls;
        }

        const startButton =
            findAnimationStartButton(activity);

        if (
            startButton &&
            !isDisabled(startButton)
        ) {
            log(
                `Starting ${title}`,
                "Waiting for numbered controls."
            );

            startButton.click();
            await sleep(CONFIG.clickDelay);
        }

        return waitForCondition(() => {
            const currentControls =
                findAnimationControls(activity);

            if (!currentControls) {
                return null;
            }

            return getAnimationSteps(
                activity,
                currentControls
            ).length > 0
                ? currentControls
                : null;
        }, CONFIG.controlsTimeout);
    }

    async function enableDoubleSpeed(activity, controls) {
        const checkbox =
            controls.querySelector(
                '.speed-control input[type="checkbox"]'
            ) ||
            activity.querySelector(
                '.speed-control input[type="checkbox"]'
            );

        if (!checkbox) {
            return false;
        }

        if (!checkbox.checked) {
            checkbox.click();

            await waitForCondition(
                () => checkbox.checked,
                2000,
                50
            );
        }

        return checkbox.checked;
    }

    async function waitForStepCompletion(
        activity,
        controls,
        currentStep,
        nextStep
    ) {
        const startedAt = Date.now();
        let sawPlaying = false;

        while (
            helperEnabled &&
            Date.now() - startedAt < CONFIG.stepTimeout
        ) {
            const playing =
                isAnimationPlaying(activity, controls);

            if (playing) {
                sawPlaying = true;
            }

            const highlighted =
                getHighlightedStep(activity, controls);

            const highlightChanged =
                highlighted &&
                highlighted !== currentStep;

            const nextUnlocked =
                nextStep &&
                !isDisabled(nextStep);

            if (
                highlightChanged ||
                (sawPlaying && !playing) ||
                (
                    nextUnlocked &&
                    Date.now() - startedAt > 800
                )
            ) {
                return true;
            }

            await sleep(150);
        }

        return false;
    }

    async function runAnimation(
        activity,
        index,
        total
    ) {
        if (
            !helperEnabled ||
            runningAnimations.has(activity) ||
            finishedAnimations.has(activity)
        ) {
            return;
        }

        runningAnimations.add(activity);

        const title = getActivityTitle(activity, index);

        try {
            activity.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            await sleep(300);

            const controls = await openAnimation(
                activity,
                title
            );

            if (!controls) {
                log(
                    `${title} could not start.`,
                    "Numbered controls never appeared."
                );

                return;
            }

            const speedEnabled =
                await enableDoubleSpeed(
                    activity,
                    controls
                );

            log(
                `${title} — ${index + 1}/${total}`,
                speedEnabled
                    ? "2× speed enabled."
                    : "No 2× control was found."
            );

            let safety = 0;

            while (
                helperEnabled &&
                safety < CONFIG.maxAnimationSteps
            ) {
                safety++;

                const steps = getAnimationSteps(
                    activity,
                    controls
                );

                if (steps.length === 0) {
                    return;
                }

                let currentStep =
                    getHighlightedStep(
                        activity,
                        controls
                    );

                if (
                    !currentStep ||
                    !steps.includes(currentStep)
                ) {
                    currentStep = steps.find(step => {
                        return !isDisabled(step);
                    });
                }

                if (!currentStep) {
                    await sleep(400);
                    continue;
                }

                const currentIndex =
                    steps.indexOf(currentStep);

                const nextStep =
                    steps[currentIndex + 1] || null;

                if (
                    !currentStep.classList.contains(
                        "step-highlight"
                    )
                ) {
                    currentStep.click();
                    await sleep(CONFIG.clickDelay);
                }

                log(
                    title,
                    `Playing step ${getStepNumber(currentStep)}.`
                );

                const playButton = findPlayButton(
                    activity,
                    controls
                );

                if (
                    playButton &&
                    !isDisabled(playButton) &&
                    !isAnimationPlaying(
                        activity,
                        controls
                    )
                ) {
                    playButton.click();
                    await sleep(CONFIG.clickDelay);
                }

                const finished =
                    await waitForStepCompletion(
                        activity,
                        controls,
                        currentStep,
                        nextStep
                    );

                if (!finished) {
                    log(
                        `${title} timed out.`,
                        `Step ${getStepNumber(currentStep)} did not finish.`
                    );

                    return;
                }

                if (!nextStep) {
                    finishedAnimations.add(activity);

                    log(
                        `${title} completed.`,
                        "All animation steps finished."
                    );

                    return;
                }

                const unlocked =
                    await waitForCondition(
                        () => !isDisabled(nextStep),
                        5000,
                        100
                    );

                if (!unlocked) {
                    return;
                }

                nextStep.click();
                await sleep(CONFIG.clickDelay);
            }
        } catch (error) {
            console.error(error);

            log(
                `${title} encountered an error.`,
                error.message
            );
        } finally {
            runningAnimations.delete(activity);
            updateCounters();
        }
    }

    async function runAllAnimations() {
        const activities = getAnimationActivities();

        for (
            let index = 0;
            index < activities.length;
            index++
        ) {
            if (!helperEnabled) {
                return;
            }

            await runAnimation(
                activities[index],
                index,
                activities.length
            );

            await sleep(CONFIG.betweenAnimationsDelay);
        }
    }

    /*
     * =====================================================
     * MULTIPLE CHOICE
     * =====================================================
     */

    function getMultipleChoiceQuestions() {
        const primary = [
            ...document.querySelectorAll(
                ".question-set-question.multiple-choice-question"
            )
        ];

        if (primary.length > 0) {
            return primary;
        }

        return [
            ...document.querySelectorAll(
                ".question-set-question"
            )
        ].filter(question => {
            return Boolean(
                question.querySelector(
                    '.question-choices input[type="radio"]'
                )
            );
        });
    }

    function getQuestionLabel(question, index) {
        return (
            normalizeText(
                question.querySelector(".setup .label")
                    ?.textContent
            ) ||
            `${index + 1})`
        );
    }

    function getQuestionText(question) {
        return (
            normalizeText(
                question.querySelector(".setup .text")
                    ?.textContent
            ) ||
            normalizeText(
                question.querySelector(".question-text")
                    ?.textContent
            ) ||
            "Multiple-choice question"
        );
    }

    function getQuestionChoices(question) {
        return [
            ...question.querySelectorAll(
                '.question-choices input[type="radio"]'
            )
        ];
    }

    function getChoiceLabel(input) {
        if (!input) {
            return null;
        }

        const labelledBy =
            input.getAttribute("aria-labelledby");

        if (labelledBy) {
            const ids = labelledBy
                .split(/\s+/)
                .filter(Boolean);

            for (const id of ids) {
                const element =
                    document.getElementById(id);

                if (element && element !== input) {
                    return element;
                }
            }
        }

        if (input.id) {
            const explicit = document.querySelector(
                `label[for="${CSS.escape(input.id)}"]`
            );

            if (explicit) {
                return explicit;
            }
        }

        return (
            input.closest(".zb-radio-button")
                ?.querySelector("label") ||
            input.parentElement?.querySelector("label") ||
            null
        );
    }

    function getChoiceText(input, index = 0) {
        return (
            normalizeText(
                getChoiceLabel(input)?.textContent
            ) ||
            normalizeText(input?.value) ||
            `Option ${index + 1}`
        );
    }

    function getExplanation(question) {
        return question.querySelector(
            ".zb-explanation"
        );
    }

    function getQuestionResult(question) {
        const explanation =
            getExplanation(question);

        if (!explanation) {
            return "pending";
        }

        if (
            explanation.classList.contains("correct")
        ) {
            return "correct";
        }

        if (
            explanation.classList.contains("incorrect")
        ) {
            return "incorrect";
        }

        const message = normalizeText(
            explanation.querySelector(".message")
                ?.textContent
        ).toLowerCase();

        if (message === "correct") {
            return "correct";
        }

        if (message === "incorrect") {
            return "incorrect";
        }

        return "pending";
    }

    function getExplanationText(question) {
        return normalizeText(
            getExplanation(question)?.textContent
        );
    }

    function displayQuestionResult(question, index) {
        const result = getQuestionResult(question);
        const label = getQuestionLabel(question, index);

        if (result === "correct") {
            question.style.outline =
                "3px solid #449a50";
            question.style.outlineOffset = "4px";
            question.style.borderRadius = "5px";

            log(
                `Question ${label} is correct.`,
                getExplanationText(question)
            );
        } else if (result === "incorrect") {
            question.style.outline =
                "3px solid #c04b4b";
            question.style.outlineOffset = "4px";
            question.style.borderRadius = "5px";
        }

        return result;
    }

    function clickChoice(question, input) {
        if (!input || isDisabled(input)) {
            return false;
        }

        question.style.outline = "";
        question.style.outlineOffset = "";

        const label = getChoiceLabel(input);

        if (label && isVisible(label)) {
            label.click();
        } else {
            input.click();
        }

        if (!input.checked) {
            input.click();
        }

        input.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );

        return true;
    }

    async function waitForQuestionResult(
        question,
        previousResult,
        previousExplanation
    ) {
        const startedAt = Date.now();

        while (
            helperEnabled &&
            Date.now() - startedAt <
                CONFIG.answerResultTimeout
        ) {
            const result =
                getQuestionResult(question);

            const explanation =
                getExplanationText(question);

            if (
                (
                    result === "correct" ||
                    result === "incorrect"
                ) &&
                (
                    result !== previousResult ||
                    explanation !== previousExplanation ||
                    previousResult === "pending"
                )
            ) {
                return result;
            }

            await sleep(100);
        }

        const finalResult =
            getQuestionResult(question);

        return finalResult === "pending"
            ? null
            : finalResult;
    }

    async function testQuestion(
        question,
        index,
        total
    ) {
        if (
            !helperEnabled ||
            runningQuestions.has(question) ||
            completedQuestions.has(question)
        ) {
            return;
        }

        if (getQuestionResult(question) === "correct") {
            completedQuestions.add(question);
            displayQuestionResult(question, index);
            return;
        }

        const initialChoices =
            getQuestionChoices(question);

        if (initialChoices.length === 0) {
            return;
        }

        runningQuestions.add(question);

        const label =
            getQuestionLabel(question, index);

        try {
            question.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            await sleep(300);

            const maximumAttempts = Math.min(
                initialChoices.length,
                CONFIG.maxAnswerAttempts
            );

            for (
                let choiceIndex = 0;
                choiceIndex < maximumAttempts;
                choiceIndex++
            ) {
                if (!helperEnabled) {
                    return;
                }

                const currentChoices =
                    getQuestionChoices(question);

                const input =
                    currentChoices[choiceIndex];

                if (!input) {
                    return;
                }

                const choiceText =
                    getChoiceText(input, choiceIndex);

                const previousResult =
                    getQuestionResult(question);

                const previousExplanation =
                    getExplanationText(question);

                log(
                    `Testing question ${label}`,
                    `Trying option ${choiceIndex + 1}: ${choiceText}`
                );

                if (!clickChoice(question, input)) {
                    continue;
                }

                await sleep(CONFIG.answerDelay);

                const result =
                    await waitForQuestionResult(
                        question,
                        previousResult,
                        previousExplanation
                    );

                displayQuestionResult(
                    question,
                    index
                );

                if (result === "correct") {
                    completedQuestions.add(question);

                    log(
                        `Question ${label} completed.`,
                        `Correct option: ${choiceText} — ${index + 1}/${total}`
                    );

                    return;
                }

                if (result !== "incorrect") {
                    log(
                        `Question ${label} did not respond.`,
                        `No result appeared for ${choiceText}.`
                    );

                    return;
                }

                await sleep(
                    CONFIG.betweenQuestionsDelay
                );
            }
        } catch (error) {
            console.error(error);

            log(
                `Question ${label} encountered an error.`,
                error.message
            );
        } finally {
            runningQuestions.delete(question);
            updateCounters();
        }
    }

    async function runAllQuestions() {
        const questions =
            getMultipleChoiceQuestions();

        for (
            let index = 0;
            index < questions.length;
            index++
        ) {
            if (!helperEnabled) {
                return;
            }

            await testQuestion(
                questions[index],
                index,
                questions.length
            );

            await sleep(CONFIG.betweenQuestionsDelay);
        }
    }

    /*
     * =====================================================
     * SHORT ANSWERS
     * =====================================================
     */

    function getShortAnswerQuestions() {
        return [
            ...document.querySelectorAll(
                ".question-set-question.short-answer-question"
            )
        ].filter(question => {
            return Boolean(
                getShortAnswerInput(question) &&
                getShortAnswerCheckButton(question)
            );
        });
    }

    function getShortAnswerInput(question) {
        return question.querySelector(
            ".short-answer-input-container input, " +
            ".short-answer-input-container textarea, " +
            '.question-container input[type="text"], ' +
            ".question-container textarea"
        );
    }

    function getShortAnswerShowButton(question) {
        return question.querySelector(
            "button.show-answer-button"
        );
    }

    function getShortAnswerCheckButton(question) {
        return question.querySelector(
            "button.check-button"
        );
    }

    function getRevealedShortAnswer(question) {
        const answer = question.querySelector(
            ".zb-explanation .forfeit-answer, " +
            ".zb-explanation .answers .answer"
        );

        return answer
            ? String(answer.textContent || "").trim()
            : "";
    }

    function setShortAnswerValue(input, answer) {
        if (!input || isDisabled(input)) {
            return false;
        }

        const prototype = input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;

        const valueSetter = Object.getOwnPropertyDescriptor(
            prototype,
            "value"
        )?.set;

        if (valueSetter) {
            valueSetter.call(input, answer);
        } else {
            input.value = answer;
        }

        input.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );

        return input.value === answer;
    }

    async function revealShortAnswer(question) {
        const existingAnswer =
            getRevealedShortAnswer(question);

        if (existingAnswer) {
            return existingAnswer;
        }

        for (
            let clickIndex = 0;
            clickIndex < CONFIG.maxShortAnswerRevealClicks;
            clickIndex++
        ) {
            const showButton =
                getShortAnswerShowButton(question);

            if (!showButton || isDisabled(showButton)) {
                return "";
            }

            const previousFeedback = normalizeText(
                getExplanation(question)?.textContent
            );

            showButton.click();

            const revealState = await waitForCondition(() => {
                const answer =
                    getRevealedShortAnswer(question);

                if (answer) {
                    return {
                        answer
                    };
                }

                const explanation =
                    getExplanation(question);

                const feedback = normalizeText(
                    explanation?.textContent
                );

                const asksForSecondClick = Boolean(
                    explanation?.querySelector(".show-again") ||
                    feedback.toLowerCase().includes(
                        "press again"
                    )
                );

                if (
                    asksForSecondClick ||
                    (
                        feedback &&
                        feedback !== previousFeedback
                    )
                ) {
                    return {
                        retry: true
                    };
                }

                return null;
            }, Math.min(
                CONFIG.shortAnswerRevealTimeout,
                2000
            ), 100);

            if (revealState?.answer) {
                return revealState.answer;
            }

            if (
                clickIndex + 1 <
                    CONFIG.maxShortAnswerRevealClicks
            ) {
                await sleep(CONFIG.clickDelay);
            }
        }

        return await waitForCondition(
            () => getRevealedShortAnswer(question),
            CONFIG.shortAnswerRevealTimeout,
            100
        ) || "";
    }

    async function completeShortAnswer(
        question,
        index,
        total
    ) {
        if (
            !helperEnabled ||
            runningShortAnswers.has(question) ||
            completedShortAnswers.has(question)
        ) {
            return;
        }

        if (getQuestionResult(question) === "correct") {
            completedShortAnswers.add(question);
            displayQuestionResult(question, index);
            return;
        }

        runningShortAnswers.add(question);

        const label = getQuestionLabel(question, index);

        try {
            question.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            await sleep(300);

            log(
                `Revealing short answer ${label}`,
                getQuestionText(question)
            );

            const answer = await revealShortAnswer(question);

            if (!answer) {
                log(
                    `Short answer ${label} could not be revealed.`,
                    "No answer appeared after clicking Show answer."
                );

                return;
            }

            const input = getShortAnswerInput(question);

            if (!setShortAnswerValue(input, answer)) {
                log(
                    `Short answer ${label} could not be entered.`,
                    `Revealed answer: ${answer}`
                );

                return;
            }

            await sleep(CONFIG.answerDelay);

            const checkButton =
                getShortAnswerCheckButton(question);

            if (!checkButton || isDisabled(checkButton)) {
                log(
                    `Short answer ${label} could not be checked.`,
                    "The Check button is unavailable."
                );

                return;
            }

            const previousResult =
                getQuestionResult(question);

            const previousExplanation =
                getExplanationText(question);

            log(
                `Checking short answer ${label}`,
                `Entered: ${answer}`
            );

            checkButton.click();

            const result = await waitForQuestionResult(
                question,
                previousResult,
                previousExplanation
            );

            displayQuestionResult(question, index);

            if (result === "correct") {
                completedShortAnswers.add(question);

                log(
                    `Short answer ${label} completed.`,
                    `${index + 1}/${total}`
                );

                return;
            }

            log(
                `Short answer ${label} was not accepted.`,
                result === "incorrect"
                    ? "The revealed answer was marked incorrect."
                    : "No result appeared after checking the answer."
            );
        } catch (error) {
            console.error(error);

            log(
                `Short answer ${label} encountered an error.`,
                error.message
            );
        } finally {
            runningShortAnswers.delete(question);
            updateCounters();
        }
    }

    async function runAllShortAnswers() {
        const questions = getShortAnswerQuestions();

        for (
            let index = 0;
            index < questions.length;
            index++
        ) {
            if (!helperEnabled) {
                return;
            }

            await completeShortAnswer(
                questions[index],
                index,
                questions.length
            );

            await sleep(
                CONFIG.betweenShortAnswersDelay
            );
        }
    }

    /*
     * =====================================================
     * DRAG/DROP MATCHING
     * =====================================================
     */

    function getMatchingActivities() {
        return [
            ...document.querySelectorAll(
                ".interactive-activity-container"
            )
        ].filter(activity => {
            return Boolean(
                activity.querySelector(
                    ".definition-match-payload .zb-sortable"
                )
            );
        });
    }

    function getTermBank(activity) {
        return activity.querySelector(
            ".zb-sortable-container.term-bank"
        );
    }

    function getMatchBuckets(activity) {
        return [
            ...activity.querySelectorAll(
                ".definition-row .term-bucket"
            )
        ];
    }

    function getDirectTerms(container) {
        if (!container) {
            return [];
        }

        return [
            ...container.querySelectorAll(
                ".definition-match-term"
            )
        ].filter(term => {
            return term.parentElement === container;
        });
    }

    function getTermKey(term) {
        const dataId = term?.getAttribute("data-id");

        if (dataId) {
            return `id:${dataId}`;
        }

        return `text:${normalizeText(term?.textContent)}`;
    }

    function getTermText(term) {
        return (
            normalizeText(term?.textContent) ||
            "Unnamed term"
        );
    }

    function findTermByKey(activity, key) {
        const terms = [
            ...activity.querySelectorAll(
                ".definition-match-term"
            )
        ];

        return terms.find(term => {
            return getTermKey(term) === key;
        }) || null;
    }

    function getBucketDescription(bucket) {
        const row = bucket.closest(".definition-row");

        return (
            normalizeText(
                row?.querySelector(".definition")
                    ?.textContent
            ) ||
            bucket.getAttribute("aria-label") ||
            bucket.id ||
            "bucket"
        );
    }

    function getBucketRow(bucket) {
        return bucket.closest(".definition-row");
    }

    function getMatchExplanation(row) {
        return row?.querySelector(
            ".definition-match-explanation"
        ) || null;
    }

    function getMatchResult(row) {
        if (!row) {
            return "pending";
        }

        const explanation =
            getMatchExplanation(row);

        const searchableElements = [
            row,
            explanation,
            row.querySelector(".term-bucket"),
            row.querySelector(".definition-match-term")
        ].filter(Boolean);

        for (const element of searchableElements) {
            if (
                element.classList.contains("correct") ||
                element.classList.contains("matched") ||
                element.getAttribute("data-correct") === "true" ||
                element.getAttribute("aria-invalid") === "false"
            ) {
                return "correct";
            }

            if (
                element.classList.contains("incorrect") ||
                element.classList.contains("wrong") ||
                element.getAttribute("data-correct") === "false" ||
                element.getAttribute("aria-invalid") === "true"
            ) {
                return "incorrect";
            }
        }

        const message = normalizeText(
            explanation?.textContent
        ).toLowerCase();

        if (
            /\b(correct|matched|accepted|right)\b/.test(message) &&
            !/\b(incorrect|not correct|wrong)\b/.test(message)
        ) {
            return "correct";
        }

        if (
            /\b(incorrect|wrong|try again|not correct)\b/.test(message)
        ) {
            return "incorrect";
        }

        return "pending";
    }

    function getMatchFingerprint(row) {
        const explanation =
            getMatchExplanation(row);

        return [
            row?.className || "",
            explanation?.className || "",
            normalizeText(explanation?.textContent)
        ].join("|");
    }

    function createDataTransfer() {
        try {
            return new DataTransfer();
        } catch {
            const data = new Map();

            return {
                dropEffect: "move",
                effectAllowed: "all",
                files: [],
                items: [],
                types: [],
                setData(type, value) {
                    data.set(type, String(value));

                    if (!this.types.includes(type)) {
                        this.types.push(type);
                    }
                },
                getData(type) {
                    return data.get(type) || "";
                },
                clearData(type) {
                    if (type) {
                        data.delete(type);
                        this.types = this.types.filter(
                            current => current !== type
                        );
                    } else {
                        data.clear();
                        this.types = [];
                    }
                },
                setDragImage() {}
            };
        }
    }

    function getElementCenter(element) {
        const rectangle =
            element.getBoundingClientRect();

        return {
            x: rectangle.left + rectangle.width / 2,
            y: rectangle.top + rectangle.height / 2
        };
    }

    function dispatchMouseEvent(
        target,
        type,
        coordinates,
        options = {}
    ) {
        const EventConstructor =
            type.startsWith("pointer") &&
            typeof PointerEvent !== "undefined"
                ? PointerEvent
                : MouseEvent;

        const event = new EventConstructor(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX: coordinates.x,
            clientY: coordinates.y,
            screenX: coordinates.x,
            screenY: coordinates.y,
            button: options.button ?? 0,
            buttons: options.buttons ?? 1,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true
        });

        target.dispatchEvent(event);
    }

    function dispatchDragEvent(
        target,
        type,
        coordinates,
        dataTransfer
    ) {
        let event;

        try {
            event = new DragEvent(type, {
                bubbles: true,
                cancelable: true,
                composed: true,
                clientX: coordinates.x,
                clientY: coordinates.y,
                dataTransfer
            });
        } catch {
            event = new Event(type, {
                bubbles: true,
                cancelable: true,
                composed: true
            });

            Object.defineProperty(event, "clientX", {
                value: coordinates.x
            });

            Object.defineProperty(event, "clientY", {
                value: coordinates.y
            });

            Object.defineProperty(event, "dataTransfer", {
                value: dataTransfer
            });
        }

        target.dispatchEvent(event);
    }

    async function performSyntheticDrag(
        source,
        target
    ) {
        if (
            !source ||
            !target ||
            !source.isConnected ||
            !target.isConnected
        ) {
            return false;
        }

        source.scrollIntoView({
            behavior: "auto",
            block: "center"
        });

        target.scrollIntoView({
            behavior: "auto",
            block: "center"
        });

        await sleep(150);

        const sourceCenter =
            getElementCenter(source);

        const targetCenter =
            getElementCenter(target);

        const dataTransfer =
            createDataTransfer();

        dataTransfer.setData(
            "text/plain",
            source.getAttribute("data-id") ||
            getTermText(source)
        );

        dispatchMouseEvent(
            source,
            "pointerdown",
            sourceCenter,
            { buttons: 1 }
        );

        dispatchMouseEvent(
            source,
            "mousedown",
            sourceCenter,
            { buttons: 1 }
        );

        dispatchDragEvent(
            source,
            "dragstart",
            sourceCenter,
            dataTransfer
        );

        await sleep(80);

        const steps = 8;

        for (
            let step = 1;
            step <= steps;
            step++
        ) {
            const progress = step / steps;

            const point = {
                x: sourceCenter.x +
                    (targetCenter.x - sourceCenter.x) *
                    progress,
                y: sourceCenter.y +
                    (targetCenter.y - sourceCenter.y) *
                    progress
            };

            dispatchMouseEvent(
                document.elementFromPoint(
                    point.x,
                    point.y
                ) || target,
                "pointermove",
                point,
                { buttons: 1 }
            );

            dispatchMouseEvent(
                document.elementFromPoint(
                    point.x,
                    point.y
                ) || target,
                "mousemove",
                point,
                { buttons: 1 }
            );

            dispatchDragEvent(
                document.elementFromPoint(
                    point.x,
                    point.y
                ) || target,
                "dragover",
                point,
                dataTransfer
            );

            await sleep(30);
        }

        dispatchDragEvent(
            target,
            "dragenter",
            targetCenter,
            dataTransfer
        );

        dispatchDragEvent(
            target,
            "dragover",
            targetCenter,
            dataTransfer
        );

        dispatchDragEvent(
            target,
            "drop",
            targetCenter,
            dataTransfer
        );

        dispatchDragEvent(
            source,
            "dragend",
            targetCenter,
            dataTransfer
        );

        dispatchMouseEvent(
            target,
            "pointerup",
            targetCenter,
            { buttons: 0 }
        );

        dispatchMouseEvent(
            target,
            "mouseup",
            targetCenter,
            { buttons: 0 }
        );

        await sleep(CONFIG.dragDelay);

        return true;
    }

    function dispatchKeyboardEvent(
        target,
        type,
        key
    ) {
        const event = new KeyboardEvent(type, {
            key,
            code: key === " "
                ? "Space"
                : key,
            bubbles: true,
            cancelable: true,
            composed: true
        });

        target.dispatchEvent(event);
    }

    async function pressKey(target, key) {
        dispatchKeyboardEvent(
            target,
            "keydown",
            key
        );

        dispatchKeyboardEvent(
            target,
            "keypress",
            key
        );

        dispatchKeyboardEvent(
            target,
            "keyup",
            key
        );

        await sleep(90);
    }

    async function performKeyboardDrop(
        source,
        target,
        activity
    ) {
        if (
            !source?.isConnected ||
            !target?.isConnected
        ) {
            return false;
        }

        const buckets = getMatchBuckets(activity);
        const targetIndex = buckets.indexOf(target);

        if (targetIndex < 0) {
            return false;
        }

        source.focus();
        await sleep(100);

        await pressKey(source, " ");

        for (
            let index = 0;
            index <= targetIndex;
            index++
        ) {
            const focused =
                document.activeElement || source;

            await pressKey(focused, "ArrowDown");
        }

        const focused =
            document.activeElement || source;

        await pressKey(focused, " ");
        await sleep(CONFIG.dragDelay);

        return true;
    }

    async function moveTerm(
        activity,
        term,
        target
    ) {
        const termKey = getTermKey(term);

        await performSyntheticDrag(
            term,
            target
        );

        let currentTerm =
            findTermByKey(activity, termKey);

        if (
            currentTerm &&
            currentTerm.parentElement === target
        ) {
            return true;
        }

        currentTerm =
            findTermByKey(activity, termKey);

        if (!currentTerm) {
            return true;
        }

        await performKeyboardDrop(
            currentTerm,
            target,
            activity
        );

        currentTerm =
            findTermByKey(activity, termKey);

        return (
            !currentTerm ||
            currentTerm.parentElement === target
        );
    }

    async function waitForMatchOutcome(
        activity,
        termKey,
        bucket,
        row,
        previousFingerprint
    ) {
        const startedAt = Date.now();
        let placedAt = null;

        while (
            helperEnabled &&
            Date.now() - startedAt <
                CONFIG.matchResultTimeout
        ) {
            const result = getMatchResult(row);

            if (result === "correct") {
                return "correct";
            }

            if (result === "incorrect") {
                return "incorrect";
            }

            const term =
                findTermByKey(activity, termKey);

            const inTarget =
                term?.parentElement === bucket;

            const inBank =
                term?.parentElement?.classList
                    .contains("term-bank");

            const fingerprint =
                getMatchFingerprint(row);

            if (
                fingerprint !== previousFingerprint
            ) {
                const changedResult =
                    getMatchResult(row);

                if (
                    changedResult === "correct" ||
                    changedResult === "incorrect"
                ) {
                    return changedResult;
                }
            }

            if (!term) {
                return "correct";
            }

            if (inBank && Date.now() - startedAt > 400) {
                return "incorrect";
            }

            if (inTarget) {
                if (placedAt === null) {
                    placedAt = Date.now();
                }

                if (
                    Date.now() - placedAt >=
                        CONFIG.stablePlacementTime
                ) {
                    return "correct";
                }
            } else {
                placedAt = null;
            }

            await sleep(100);
        }

        const finalTerm =
            findTermByKey(activity, termKey);

        if (
            !finalTerm ||
            finalTerm.parentElement === bucket
        ) {
            return "correct";
        }

        return null;
    }

    async function returnTermToBank(
        activity,
        termKey
    ) {
        const bank = getTermBank(activity);
        const term = findTermByKey(
            activity,
            termKey
        );

        if (!bank || !term) {
            return false;
        }

        if (term.parentElement === bank) {
            return true;
        }

        await moveTerm(activity, term, bank);

        return Boolean(
            await waitForCondition(() => {
                const current =
                    findTermByKey(
                        activity,
                        termKey
                    );

                return (
                    !current ||
                    current.parentElement === bank
                );
            }, 3000, 100)
        );
    }

    async function findBucketForTerm(
        activity,
        term,
        activityIndex
    ) {
        const termKey = getTermKey(term);
        const termText = getTermText(term);
        const buckets = getMatchBuckets(activity);

        for (
            let bucketIndex = 0;
            bucketIndex < buckets.length;
            bucketIndex++
        ) {
            if (!helperEnabled) {
                return false;
            }

            const bucket = buckets[bucketIndex];

            if (getDirectTerms(bucket).length > 0) {
                continue;
            }

            const currentTerm =
                findTermByKey(activity, termKey);

            if (!currentTerm) {
                return true;
            }

            const row = getBucketRow(bucket);
            const description =
                getBucketDescription(bucket);

            const previousFingerprint =
                getMatchFingerprint(row);

            log(
                `Testing matching term: ${termText}`,
                `Trying bucket ${bucketIndex + 1}: ${description}`
            );

            const moved = await moveTerm(
                activity,
                currentTerm,
                bucket
            );

            if (!moved) {
                log(
                    `Could not move ${termText}.`,
                    `Bucket ${bucketIndex + 1} did not receive the term.`
                );

                continue;
            }

            const result =
                await waitForMatchOutcome(
                    activity,
                    termKey,
                    bucket,
                    row,
                    previousFingerprint
                );

            if (result === "correct") {
                row.style.outline =
                    "3px solid #449a50";
                row.style.outlineOffset = "4px";
                row.style.borderRadius = "5px";

                log(
                    `${termText} matched.`,
                    description
                );

                return true;
            }

            row.style.outline =
                "3px solid #c04b4b";
            row.style.outlineOffset = "4px";
            row.style.borderRadius = "5px";

            log(
                `${termText} was rejected.`,
                `Trying the next bucket.`
            );

            await returnTermToBank(
                activity,
                termKey
            );

            await sleep(
                CONFIG.betweenBucketsDelay
            );

            row.style.outline = "";
            row.style.outlineOffset = "";
        }

        log(
            `No bucket accepted ${termText}.`,
            `Matching activity ${activityIndex + 1} will be retried later.`
        );

        return false;
    }

    async function runMatchingActivity(
        activity,
        index,
        total
    ) {
        if (
            !helperEnabled ||
            runningMatchingActivities.has(activity) ||
            completedMatchingActivities.has(activity)
        ) {
            return;
        }

        runningMatchingActivities.add(activity);

        const title = getActivityTitle(
            activity,
            index
        );

        try {
            activity.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            await sleep(300);

            const bank = getTermBank(activity);
            const buckets = getMatchBuckets(activity);

            if (!bank || buckets.length === 0) {
                return;
            }

            log(
                `${title} — ${index + 1}/${total}`,
                `${getDirectTerms(bank).length} terms and ${buckets.length} buckets found.`
            );

            let passes = 0;

            while (
                helperEnabled &&
                passes < CONFIG.maxMatchingPasses
            ) {
                passes++;

                const remainingTerms =
                    getDirectTerms(bank);

                if (remainingTerms.length === 0) {
                    completedMatchingActivities.add(
                        activity
                    );

                    log(
                        `${title} completed.`,
                        "Every term was matched."
                    );

                    return;
                }

                const term = remainingTerms[0];

                const matched =
                    await findBucketForTerm(
                        activity,
                        term,
                        index
                    );

                if (!matched) {
                    return;
                }

                await sleep(CONFIG.betweenTermsDelay);
            }
        } catch (error) {
            console.error(error);

            log(
                `${title} encountered an error.`,
                error.message
            );
        } finally {
            runningMatchingActivities.delete(
                activity
            );

            if (isMatchingActivityComplete(activity)) {
                completedMatchingActivities.add(
                    activity
                );
            }

            updateCounters();
        }
    }

    async function runAllMatchingActivities() {
        const activities =
            getMatchingActivities();

        for (
            let index = 0;
            index < activities.length;
            index++
        ) {
            if (!helperEnabled) {
                return;
            }

            await runMatchingActivity(
                activities[index],
                index,
                activities.length
            );

            await sleep(CONFIG.betweenTermsDelay);
        }
    }

    /*
     * =====================================================
     * MAIN RUNNER
     * =====================================================
     */

    function hasUnfinishedWork() {
        const renderWork =
            getRenderWebpageButtons().some(button => {
                return (
                    !clickedRenderButtons.has(button) &&
                    !isDisabled(button)
                );
            });

        const animationWork =
            getAnimationActivities().some(activity => {
                return (
                    !finishedAnimations.has(activity) &&
                    !runningAnimations.has(activity)
                );
            });

        const questionWork =
            getMultipleChoiceQuestions().some(question => {
                return (
                    getQuestionResult(question) !==
                        "correct" &&
                    !completedQuestions.has(question) &&
                    !runningQuestions.has(question)
                );
            });

        const shortAnswerWork =
            getShortAnswerQuestions().some(question => {
                return (
                    getQuestionResult(question) !==
                        "correct" &&
                    !completedShortAnswers.has(question) &&
                    !runningShortAnswers.has(question)
                );
            });

        const matchingWork =
            getMatchingActivities().some(activity => {
                return (
                    !completedMatchingActivities.has(
                        activity
                    ) &&
                    !runningMatchingActivities.has(
                        activity
                    ) &&
                    !isMatchingActivityComplete(
                        activity
                    )
                );
            });

        return (
            renderWork ||
            animationWork ||
            questionWork ||
            shortAnswerWork ||
            matchingWork
        );
    }

    async function runAll() {
        if (
            runnerBusy ||
            !helperEnabled
        ) {
            return;
        }

        runnerBusy = true;

        try {
            await clickAllRenderWebpageButtons();

            if (!helperEnabled) {
                return;
            }

            await runAllAnimations();

            if (!helperEnabled) {
                return;
            }

            await runAllQuestions();

            if (!helperEnabled) {
                return;
            }

            await runAllShortAnswers();

            if (!helperEnabled) {
                return;
            }

            await runAllMatchingActivities();

            if (helperEnabled) {
                log(
                    "Activity scan finished.",
                    "Waiting for new or unfinished activities."
                );
            }
        } finally {
            runnerBusy = false;
            updateCounters();
        }
    }

    function queueRun(force = false) {
        if (
            runQueued ||
            runnerBusy ||
            !helperEnabled
        ) {
            return;
        }

        if (!force && !hasUnfinishedWork()) {
            return;
        }

        runQueued = true;

        setTimeout(async () => {
            runQueued = false;
            await runAll();
        }, 500);
    }

    function scanPage() {
        if (!helperEnabled) {
            return;
        }

        updateCounters();
        queueRun(false);
    }

    createPanel();

    log(
        "Local tester loaded.",
        "Animations, multiple choice, short answers, and matching are automatic."
    );

    setTimeout(
        scanPage,
        CONFIG.initialDelay
    );

    setInterval(
        scanPage,
        CONFIG.scanInterval
    );

    const pageObserver =
        new MutationObserver(() => {
            clearTimeout(mutationScanTimer);

            mutationScanTimer = setTimeout(() => {
                scanPage();
            }, 150);
        });

    pageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
            "class",
            "aria-selected",
            "aria-invalid",
            "data-correct",
            "disabled"
        ]
    });
})();
