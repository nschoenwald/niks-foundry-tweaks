/**
 * Feature: Reliable Chat Log Auto-Scroll
 * Description: Keeps the chat log reliably scrolled to the bottom when new cards appear, expand, or update, while preserving reading position when scrolled up.
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.26.0)
 * @updated niks-dnd5e-tweaks v14.57.0 (Hooks are registered even when the feature starts disabled, so enabling it mid-session works)
 * @updated v14.3.2 (Only user input can unpin the log; layout changes no longer stop auto-scrolling; re-pin on sidebar expand)
 */
import { getSetting, log, debug } from "../../context.js";

/**
 * Reliable Chat Log Auto-Scroll
 *
 * Chat messages change height after they were posted:
 *   1. `<recorded-targets>` populates targets asynchronously.
 *   2. Collapsible trays and card descriptions expand with a 250ms CSS transition.
 *   3. Child messages re-render earlier messages (`#refreshOrigin`), and modules such as midi-qol update their cards.
 *   4. Dice So Nice reveals hidden rolls once the 3D animation ends.
 *   5. Images (item icons, target avatars) load after layout.
 * Core only scrolls when a message is posted, never when one is updated.
 *
 * Core also decides whether the log is "at the bottom" (`ChatLog#isAtBottom`) from scroll events alone, and so did
 * this feature until 14.3.2. A scroll event is dispatched on the next frame and measures the layout at that time: when
 * a card grows between a scroll-to-bottom and its event, the handler sees the log above the bottom and treats it as the
 * user scrolling up. Auto-scrolling then stops until the user scrolls down by hand. Low frame rates (3D dice,
 * Sequencer effects) make it more likely, because more height is added between two frames.
 *
 * This watcher therefore keeps its own "pinned" state:
 *   - Only user input can unpin: wheel or keys scrolling up, touch scrolling, or holding a pointer in the log
 *     (scrollbar drag, text selection, middle-click autoscroll).
 *   - Reaching the bottom (<= 35px) pins again, whatever caused the scroll.
 *   - While pinned, any layout change (ResizeObserver on the log and the scroll container) and any scroll event that is
 *     not at the bottom schedules one scroll to the bottom per frame. That scroll also fires core's scroll handler, which
 *     sets core's `isAtBottom` back to true, so core and Dice So Nice follow new messages again.
 *   - The current user's own messages always pin, like core.
 */

/** @type {Map<object, ChatScrollWatcher>} Active watchers keyed by application instance */
const _activeWatchers = new Map();

/** Distance in pixels from the bottom that still counts as "at the bottom". */
const THRESHOLD = 35;

/** How long after a wheel, key or touch event a scroll counts as caused by the user (covers smooth scrolling). */
const INPUT_WINDOW_MS = 500;

/** Keys that scroll the log up. Keys that scroll down never unpin. */
const UP_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);

/**
 * Encapsulates scroll observation and pinning for a single chat log view (sidebar or popout).
 */
class ChatScrollWatcher {
    /**
     * @param {Application|ApplicationV2} app
     * @param {HTMLElement} rootElement
     * @param {boolean} [pinned=true]  Initial pinned state (carried over when the log re-renders).
     */
    constructor(app, rootElement, pinned = true) {
        this.app = app;
        this.root = rootElement;
        this.scroll = rootElement.querySelector(".chat-scroll")
            ?? rootElement.querySelector("#chat-log")?.parentElement
            ?? rootElement;
        this.log = rootElement.querySelector(".chat-log")
            ?? rootElement.querySelector("#chat-log");

        if (!this.scroll || !this.log) {
            debug("Chat Scroll Fix: could not locate .chat-scroll or .chat-log container.");
            return;
        }

        /** @type {boolean} Whether the log follows new content */
        this.pinned = pinned;

        /** @type {number} Until when (performance.now()) a scroll counts as caused by the user */
        this.userInputUntil = 0;

        /** @type {boolean} Whether a pointer is held down inside the scroll container */
        this.pointerHeld = false;

        /** @type {boolean} Whether a scroll update is already queued via requestAnimationFrame */
        this.scrollScheduled = false;

        this._setupListeners();
        this._setupObserver();

        if (this.pinned) this.scrollToBottom();
    }

    /**
     * Distance between the visible area and the end of the log, or null while the log is hidden.
     * @returns {number|null}
     */
    _distanceFromBottom() {
        if (!this.scroll.clientHeight) return null;
        return this.scroll.scrollHeight - this.scroll.scrollTop - this.scroll.clientHeight;
    }

    /**
     * Whether the user is scrolling right now.
     * @returns {boolean}
     */
    _isUserScrolling() {
        return this.pointerHeld || (performance.now() < this.userInputUntil);
    }

    /**
     * Mark the next scroll events as caused by the user.
     */
    _markUserInput() {
        this.userInputUntil = performance.now() + INPUT_WINDOW_MS;
    }

    /**
     * Update the pinned state from a scroll event.
     */
    _onScrollEvent() {
        const dist = this._distanceFromBottom();
        if (dist === null) return;
        if (dist <= THRESHOLD) {
            if (!this.pinned) debug("Chat Scroll Fix: pinned (reached the bottom)");
            this.pinned = true;
        }
        else if (this._isUserScrolling()) {
            if (this.pinned) debug("Chat Scroll Fix: unpinned (user scrolled up)");
            this.pinned = false;
        }
        // Not at the bottom and not caused by the user: the layout changed under a pending scroll. Catch up.
        else if (this.pinned) this.scrollToBottom();
    }

    /**
     * Attach scroll and user input listeners.
     * @private
     */
    _setupListeners() {
        const opts = { passive: true };
        this._listeners = [
            [this.scroll, "scroll", () => this._onScrollEvent()],
            [this.scroll, "wheel", (event) => {
                if (event.deltaY < 0) this._markUserInput();
            }],
            [this.scroll, "keydown", (event) => {
                if (UP_KEYS.has(event.key) || ((event.key === " ") && event.shiftKey)) this._markUserInput();
            }],
            [this.scroll, "touchstart", () => this._markUserInput()],
            [this.scroll, "touchmove", () => this._markUserInput()],
            // Touch momentum scrolling continues after the finger lifts.
            [this.scroll, "touchend", () => this._markUserInput()],
            [this.scroll, "pointerdown", (event) => {
                if (event.pointerType !== "touch") this.pointerHeld = true;
            }],
            [window, "pointerup", () => this._releasePointer()],
            [window, "pointercancel", () => this._releasePointer()]
        ];
        for (const [target, type, fn] of this._listeners) target.addEventListener(type, fn, opts);
    }

    /**
     * End a held pointer. Scrolls caused by the drag may still be dispatched on the next frame.
     */
    _releasePointer() {
        if (!this.pointerHeld) return;
        this.pointerHeld = false;
        this._markUserInput();
    }

    /**
     * Attach a ResizeObserver to the log (content height) and the scroll container (visible height).
     * @private
     */
    _setupObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            if (this.pinned) this.scrollToBottom();
        });
        this.resizeObserver.observe(this.log);
        this.resizeObserver.observe(this.scroll);
    }

    /**
     * Scroll the container to the bottom, batched to one scroll per frame.
     * @param {boolean} [force=false] Pin the log first, regardless of its current state.
     */
    scrollToBottom(force = false) {
        if (!this.scroll?.isConnected) return;
        if (force) this.pinned = true;
        if (!this.pinned || this.scrollScheduled) return;
        this.scrollScheduled = true;

        requestAnimationFrame(() => {
            this.scrollScheduled = false;
            if (!this.scroll?.isConnected || !this.pinned) return;
            if (this._distanceFromBottom() > 0) this.scroll.scrollTop = this.scroll.scrollHeight;
        });
    }

    /**
     * Clean up all observers and event listeners.
     */
    destroy() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        for (const [target, type, fn] of this._listeners ?? []) target.removeEventListener(type, fn);
        this._listeners = null;
    }
}

/**
 * Watch or update a chat log application instance.
 * @param {Application|ApplicationV2} app
 * @param {HTMLElement} element
 */
function _watchChatLog(app, element) {
    if (!element) return;
    const existing = _activeWatchers.get(app);
    const pinned = existing?.pinned ?? true;
    existing?.destroy();
    _activeWatchers.set(app, new ChatScrollWatcher(app, element, pinned));
}

/**
 * Initialize Reliable Chat Log Auto-Scroll.
 */
export function initChatScrollFix() {
    // The hooks are registered even while the feature is off, so turning it on mid-session
    // keeps working after the chat log re-renders. Each hook checks the setting itself.
    Hooks.on("renderChatLog", (app, element) => {
        if (!getSetting("enableChatScrollFix")) return;
        const el = element instanceof HTMLElement ? element : (element?.[0] ?? app.element);
        _watchChatLog(app, el);
    });

    Hooks.on("renderChatPopout", (app, element) => {
        if (!getSetting("enableChatScrollFix")) return;
        const el = element instanceof HTMLElement ? element : (element?.[0] ?? app.element);
        _watchChatLog(app, el);
    });

    Hooks.on("closeChatPopout", (app) => {
        _activeWatchers.get(app)?.destroy();
        _activeWatchers.delete(app);
    });

    // When the current user sends a message, snap to bottom
    Hooks.on("createChatMessage", (message) => {
        if (!getSetting("enableChatScrollFix")) return;
        if (message.author?.id === game.user?.id) {
            for (const watcher of _activeWatchers.values()) {
                watcher.scrollToBottom(true);
            }
        }
    });

    // When the chat tab is shown again (tab switch or sidebar expanded), catch up if it was pinned
    const catchUp = () => {
        if (!getSetting("enableChatScrollFix")) return;
        _activeWatchers.get(ui.chat)?.scrollToBottom();
    };
    Hooks.on("changeSidebarTab", (tab) => {
        if (tab?.tabName === "chat") catchUp();
    });
    Hooks.on("collapseSidebar", (_sidebar, collapsed) => {
        if (!collapsed) catchUp();
    });

    // If chat log is already rendered when init/setup runs, attach immediately
    if (getSetting("enableChatScrollFix") && ui.chat?.element) {
        _watchChatLog(ui.chat, ui.chat.element);
    }
}

/**
 * Dynamically enable the feature (e.g. from settings onChange).
 */
export function enableChatScrollFix() {
    if (ui.chat?.element) {
        _watchChatLog(ui.chat, ui.chat.element);
    }
    for (const popout of foundry.applications?.instances?.values?.() ?? []) {
        if (popout.element?.classList?.contains("chat-popout") || popout.constructor?.name === "ChatPopout") {
            _watchChatLog(popout, popout.element);
        }
    }
    log("Reliable Chat Log Auto-Scroll enabled dynamically");
}

/**
 * Dynamically disable the feature.
 */
export function disableChatScrollFix() {
    for (const watcher of _activeWatchers.values()) {
        watcher.destroy();
    }
    _activeWatchers.clear();
    log("Reliable Chat Log Auto-Scroll disabled");
}
