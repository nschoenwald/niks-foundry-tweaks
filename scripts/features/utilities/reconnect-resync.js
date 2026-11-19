/**
 * Feature: Resync Prompt After Short Disconnects
 * Description: After a connection drop that core doesn't answer with a reload (under 5 seconds), whispers a chat
 * message to the affected user and the GMs, with a button for that user to reload and catch up.
 *
 * @introduced v14.15.0
 */
import { MODULE_ID, getSetting, debug, log } from "../../context.js";

/**
 * Resync Prompt After Short Disconnects
 *
 * Foundry doesn't apply document changes optimistically: every create/update/delete goes to the server, which answers
 * the requesting client and broadcasts the change to everyone else. A client that is disconnected at that moment never
 * receives the broadcast, and nothing replays it later. Core (`Game.connect`, client/game.mjs) only reloads the page
 * when a reconnect takes 5 seconds or longer (`reconnectTimeRequireRefresh`). After a shorter drop, the client carries
 * on with stale data, e.g. still shows an effect another client has since removed, or misses one that was added.
 *
 * This feature watches the socket's own `disconnect` event and the manager's `reconnect` event (the same pair core
 * uses). When a reconnect comes in under `CORE_RELOAD_MS`, the reconnected client posts a chat message whispered to
 * itself and all GMs. Only that user sees the Reload button; the GMs see who dropped and whether they have reloaded.
 * Clicking it marks the message as reloaded (flag update, the author owns the message) and reloads the page.
 * An earlier prompt of the same user that is still open is deleted and its drop count carried over, so repeated
 * hiccups leave one message at the bottom of the log.
 *
 * The text is built at render time from the flags, so every viewer reads it in their own language.
 */

/** Core reloads by itself at or above this (client/game.mjs, `reconnectTimeRequireRefresh`). */
const CORE_RELOAD_MS = 5000;

/** Wait after the reconnect before writing, so the socket has settled. */
const POST_DELAY_MS = 1000;

/** Flag key on the chat message. */
const FLAG = "reconnectResync";

/** When the socket last dropped, or 0 while connected. */
let _disconnectedAt = 0;

export function initReconnectResync() {
    const socket = game.socket;
    if (!socket?.io) return;

    socket.on("disconnect", () => {
        _disconnectedAt = Date.now();
    });

    socket.io.on("reconnect", () => {
        if (!_disconnectedAt) return;
        const duration = Date.now() - _disconnectedAt;
        _disconnectedAt = 0;
        if (duration >= CORE_RELOAD_MS) return; // Core reloads the page itself
        if (!getSetting("enableReconnectResync")) return;
        debug(`Resync Prompt: reconnected after ${(duration / 1000).toFixed(1)}s, posting the resync prompt.`);
        setTimeout(() => _postPrompt(duration).catch(err => log("Resync Prompt: could not post the message.", err)), POST_DELAY_MS);
    });

    Hooks.on("renderChatMessageHTML", _onRenderChatMessage);
}

/**
 * Whisper the prompt to this user and all GMs.
 * @param {number} duration  How long the connection was lost, in milliseconds
 */
async function _postPrompt(duration) {
    if (!game.socket?.connected) return;

    // Replace an earlier open prompt of this user, keeping its count
    let count = 1;
    const previous = game.messages.contents.filter(m => {
        const flag = m.getFlag(MODULE_ID, FLAG);
        return flag && (flag.userId === game.user.id) && !flag.reloaded && m.isOwner;
    });
    for (const message of previous) count += Number(message.getFlag(MODULE_ID, FLAG).count) || 1;
    if (previous.length) await ChatMessage.implementation.deleteDocuments(previous.map(m => m.id));

    const recipients = new Set([game.user.id, ...game.users.filter(u => u.isGM).map(u => u.id)]);
    await ChatMessage.implementation.create({
        author: game.user.id,
        speaker: { alias: game.i18n.localize("NFT.ReconnectResync.Speaker") },
        whisper: [...recipients],
        // Fallback text for when the module is turned off; replaced at render time
        content: `<p>${game.i18n.format("NFT.ReconnectResync.Body", {
            name: foundry.utils.escapeHTML(game.user.name),
            seconds: (duration / 1000).toFixed(1)
        })}</p>`,
        flags: {
            [MODULE_ID]: {
                [FLAG]: { userId: game.user.id, duration, count, reloaded: false }
            }
        }
    });
}

/**
 * Rebuild the message body for the viewer: the button for the affected user, a status line for everyone else.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
function _onRenderChatMessage(message, html) {
    const flag = message.getFlag(MODULE_ID, FLAG);
    if (!flag) return;
    const content = html.querySelector(".message-content");
    if (!content) return;

    const user = game.users.get(flag.userId);
    const name = user?.name ?? game.i18n.localize("NFT.ReconnectResync.UnknownUser");
    const isSelf = flag.userId === game.user.id;
    const seconds = (Number(flag.duration) / 1000).toFixed(1);

    const box = document.createElement("div");
    box.classList.add("nft-reconnect-resync");

    const body = document.createElement("p");
    body.textContent = isSelf
        ? game.i18n.format("NFT.ReconnectResync.BodySelf", { seconds })
        : game.i18n.format("NFT.ReconnectResync.Body", { name, seconds });
    box.append(body);

    if (Number(flag.count) > 1) {
        const count = document.createElement("p");
        count.classList.add("nft-reconnect-resync-count");
        count.textContent = game.i18n.format("NFT.ReconnectResync.Count", { count: flag.count });
        box.append(count);
    }

    if (flag.reloaded) {
        const status = document.createElement("p");
        status.classList.add("nft-reconnect-resync-status");
        status.innerHTML = `<i class="fa-solid fa-check"></i> `;
        status.append(game.i18n.format(isSelf ? "NFT.ReconnectResync.ReloadedSelf" : "NFT.ReconnectResync.Reloaded", { name }));
        box.append(status);
    } else if (isSelf) {
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<i class="fa-solid fa-rotate-right"></i> `;
        button.append(game.i18n.localize("NFT.ReconnectResync.Button"));
        button.addEventListener("click", event => _onReload(event, message));
        box.append(button);
    } else {
        const status = document.createElement("p");
        status.classList.add("nft-reconnect-resync-status");
        status.textContent = game.i18n.format("NFT.ReconnectResync.Waiting", { name });
        box.append(status);
    }

    content.replaceChildren(box);
}

/**
 * Mark the prompt as handled, then reload.
 * @param {PointerEvent} event
 * @param {ChatMessage} message
 */
async function _onReload(event, message) {
    event.preventDefault();
    event.currentTarget.disabled = true;
    try {
        if (message.isOwner) await message.setFlag(MODULE_ID, FLAG, { ...message.getFlag(MODULE_ID, FLAG), reloaded: true });
    } catch (err) {
        log("Resync Prompt: could not mark the message as reloaded.", err);
    }
    window.location.reload();
}
