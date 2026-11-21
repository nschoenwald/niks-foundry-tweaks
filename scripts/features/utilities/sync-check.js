/**
 * Feature: Sync Check
 * Description: Compares this client's actors, items, effects and viewed scene tokens with the server after a short
 * disconnect, after a long time in the background, or when a GM asks. Only a confirmed difference whispers a chat
 * message to the affected user and the GMs, with a button for that user to reload and catch up.
 *
 * @introduced v14.15.0 (as Resync Prompt After Short Disconnects)
 * @updated v14.17.0 (checks against the server, message only on confirmed differences, GM check, API)
 */
import { MODULE_ID, getSetting, debug, log } from "../../context.js";

/**
 * Sync Check
 *
 * Why: every document change goes through the server, which answers the requester and broadcasts to the others. A
 * client that is disconnected at that moment never receives the broadcast (the server doesn't enable socket.io's
 * connection state recovery). Core (`Game.connect`, client/game.mjs) reloads only when a reconnect takes 5 seconds or
 * longer, measured from when the client *noticed* the drop. The server's `pingTimeout` is 10 minutes, so a silently
 * dead connection can lose minutes of changes and still "reconnect in 0.5 s".
 *
 * How: the client requests an index from the server (`database.get` with `index: true`, read-only, never broadcast)
 * with ids and `_stats.modifiedTime` of world actors and their items and effects, plus the viewed scene's token ids and
 * the item/effect overrides in their deltas. It compares that with its own `_source`. A difference is fetched again
 * after `RECHECK_MS`, and only documents that differ both times count, so changes still in flight raise no alarm.
 *
 * Not covered in this version: effects embedded in items, token data other than existence and delta items/effects
 * (Token has no `_stats`), scenes other than the viewed one, and other document types.
 *
 * Triggers: a reconnect under `CORE_RELOAD_MS`, the tab becoming visible after `WAKE_AFTER_MS` hidden, and GM requests
 * (Players list context menu, `api.syncCheck`). GM requests go through the module socket; the server passes the real
 * sender id as the listener's second argument, which is what the GM test uses.
 *
 * The message's text is built at render time from its flags, so everyone reads it in their own language. Players only
 * see names of documents they own. If the check itself fails after a reconnect, the message from 14.15.0 ("may be out
 * of sync") is the fallback. The setting key and flag key keep their 14.15.0 names.
 */

/** Core reloads by itself at or above this (client/game.mjs, `reconnectTimeRequireRefresh`). */
const CORE_RELOAD_MS = 5000;

/** Wait after the reconnect before checking, so the socket has settled. */
const CHECK_DELAY_MS = 1000;

/** Wait before fetching a difference again. */
const RECHECK_MS = 2000;

/** A tab hidden at least this long is checked when it becomes visible. */
const WAKE_AFTER_MS = 60000;

/** Give up on one server request after this long. */
const FETCH_TIMEOUT_MS = 8000;

/** How long a GM waits for the answers (two fetches and the pause between them, plus some margin). */
const REPLY_TIMEOUT_MS = 20000;

/** Most documents named in a message. */
const MAX_LINES = 5;

/** Flag key on the chat message. */
const FLAG = "reconnectResync";

const ACTOR_FIELDS = ["_id", "_stats.modifiedTime", "items._id", "items._stats.modifiedTime", "effects._id", "effects._stats.modifiedTime"];
const SCENE_FIELDS = ["_id", "tokens._id", "tokens.delta.items", "tokens.delta.effects"];

/** When the socket last dropped, or 0 while connected. */
let _disconnectedAt = 0;

/** When the tab was hidden, or 0 while visible. */
let _hiddenAt = 0;

/** The check in progress, or null. */
let _running = null;

/** Open GM requests: request id -> answer callback. */
const _pendingRequests = new Map();

/* -------------------------------------------- */
/*  Comparison                                  */
/* -------------------------------------------- */

/**
 * The version of an embedded entry.
 * @param {object} entry
 * @returns {string}
 */
function _version(entry) {
    return entry._tombstone ? "tombstone" : String(entry._stats?.modifiedTime ?? "");
}

/**
 * Count the entries that exist on one side only or have another version.
 * @param {object[]} [serverList]
 * @param {object[]} [localList]
 * @returns {number}
 */
export function countCollectionDifferences(serverList, localList) {
    const server = new Map((serverList ?? []).map(e => [e._id, _version(e)]));
    const local = new Map((localList ?? []).map(e => [e._id, _version(e)]));
    let count = 0;
    for (const [id, version] of server) if (local.get(id) !== version) count++;
    for (const id of local.keys()) if (!server.has(id)) count++;
    return count;
}

/**
 * Compare documents by id.
 * @param {object[]} serverRows                   Index rows from the server
 * @param {Map<string, object>} localSources      This client's sources by id
 * @param {(id: string) => string} toUuid
 * @param {boolean} compareStats                  Whether the document has its own `_stats`
 * @returns {{uuid: string, data: boolean, items: number, effects: number}[]}  Sorted by uuid
 */
export function compareDocuments(serverRows, localSources, toUuid, compareStats) {
    const differences = [];
    const serverIds = new Set();
    for (const row of serverRows) {
        serverIds.add(row._id);
        const local = localSources.get(row._id);
        if (!local) {
            differences.push({ uuid: toUuid(row._id), data: true, items: 0, effects: 0 });
            continue;
        }
        const server = compareStats ? row : (row.delta ?? {});
        const source = compareStats ? local : (local.delta ?? {});
        const data = compareStats && (row._stats?.modifiedTime !== local._stats?.modifiedTime);
        const items = countCollectionDifferences(server.items, source.items);
        const effects = countCollectionDifferences(server.effects, source.effects);
        if (data || items || effects) differences.push({ uuid: toUuid(row._id), data, items, effects });
    }
    for (const id of localSources.keys()) {
        if (!serverIds.has(id)) differences.push({ uuid: toUuid(id), data: true, items: 0, effects: 0 });
    }
    return differences.sort((a, b) => a.uuid.localeCompare(b.uuid));
}

/**
 * Reject when a server request takes too long (a dead connection never answers).
 * @template T
 * @param {Promise<T>} promise
 * @returns {Promise<T>}
 */
function _withTimeout(promise) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("The server did not answer in time.")), FETCH_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Fetch the server's index and compare it with this client.
 * @returns {Promise<object[]>}
 */
async function _fetchDifferences() {
    const ActorClass = Actor.implementation;
    const actorRows = await _withTimeout(ActorClass.database.get(ActorClass, { index: true, indexFields: [...ACTOR_FIELDS] }));
    const invalidActors = game.actors.invalidDocumentIds;
    const localActors = new Map(game.actors.contents.map(a => [a.id, a._source]));
    const differences = compareDocuments(actorRows.filter(r => !invalidActors.has(r._id)), localActors, id => `Actor.${id}`, true);

    const scene = canvas?.scene;
    if (!scene) return differences;
    const SceneClass = Scene.implementation;
    const [sceneRow] = await _withTimeout(SceneClass.database.get(SceneClass, {
        query: { _id: scene.id }, index: true, indexFields: [...SCENE_FIELDS]
    }));
    if (!sceneRow) return [...differences, { uuid: scene.uuid, data: true, items: 0, effects: 0 }];

    const invalidTokens = scene.tokens.invalidDocumentIds;
    const localTokens = new Map(scene._source.tokens.filter(t => !invalidTokens.has(t._id)).map(t => [t._id, t]));
    const serverTokens = (sceneRow.tokens ?? []).filter(t => !invalidTokens.has(t._id));
    differences.push(...compareDocuments(serverTokens, localTokens, id => `${scene.uuid}.Token.${id}`, false));
    return differences;
}

/* -------------------------------------------- */
/*  Check                                       */
/* -------------------------------------------- */

/**
 * Compare this client with the server, and post or clear the message. A check already running is joined.
 * @param {object} [options]
 * @param {number|null} [options.duration]  Length of the drop, when a reconnect triggered this
 * @returns {Promise<{status: "ok"|"drift"|"error", differences: object[]}>}
 */
export function checkSync({ duration = null } = {}) {
    _running ??= _runCheck(duration).finally(() => { _running = null; });
    return _running;
}

/**
 * @param {number|null} duration
 * @returns {Promise<{status: "ok"|"drift"|"error", differences: object[]}>}
 */
async function _runCheck(duration) {
    if (!game.socket?.connected) return { status: "error", differences: [] };
    let differences;
    try {
        differences = await _fetchDifferences();
        if (differences.length) {
            const first = new Set(differences.map(d => d.uuid));
            await new Promise(resolve => setTimeout(resolve, RECHECK_MS));
            differences = (await _fetchDifferences()).filter(d => first.has(d.uuid));
        }
    } catch (err) {
        log("Sync Check: could not compare with the server.", err);
        if (duration !== null) await _postPrompt({ duration }).catch(e => log("Sync Check: could not post the message.", e));
        return { status: "error", differences: [] };
    }

    try {
        if (differences.length) await _postPrompt({ differences });
        else await _deleteOpenPrompts();
    } catch (err) {
        log("Sync Check: could not update the chat message.", err);
    }
    debug(`Sync Check: ${differences.length} document(s) differ from the server.`, differences);
    return { status: differences.length ? "drift" : "ok", differences };
}

/**
 * This user's prompts that haven't been answered with a reload.
 * @returns {ChatMessage[]}
 */
function _openPrompts() {
    return game.messages.contents.filter(m => {
        const flag = m.getFlag(MODULE_ID, FLAG);
        return flag && (flag.userId === game.user.id) && !flag.reloaded && m.isOwner;
    });
}

/** Remove open prompts after a clean check. */
async function _deleteOpenPrompts() {
    const open = _openPrompts();
    if (open.length) await ChatMessage.implementation.deleteDocuments(open.map(m => m.id));
}

/**
 * Whisper the prompt to this user and all GMs, replacing an open one. An identical open prompt stays where it is.
 * @param {object} data
 * @param {object[]} [data.differences]  Confirmed differences
 * @param {number} [data.duration]       Length of the drop, for the fallback when the check failed
 */
async function _postPrompt({ differences = null, duration = 0 }) {
    if (!game.socket?.connected) return;

    const open = _openPrompts();
    if (differences) {
        const wanted = JSON.stringify(differences);
        const same = open.find(m => JSON.stringify(m.getFlag(MODULE_ID, FLAG).differences ?? null) === wanted);
        if (same && (open.length === 1)) return;
    }
    let count = 1;
    for (const message of open) count += Number(message.getFlag(MODULE_ID, FLAG).count) || 1;
    if (open.length) await ChatMessage.implementation.deleteDocuments(open.map(m => m.id));

    const name = foundry.utils.escapeHTML(game.user.name);
    const fallback = differences
        ? game.i18n.format("NFT.SyncCheck.Body", { name })
        : game.i18n.format("NFT.ReconnectResync.Body", { name, seconds: (duration / 1000).toFixed(1) });
    const recipients = new Set([game.user.id, ...game.users.filter(u => u.isGM).map(u => u.id)]);
    await ChatMessage.implementation.create({
        author: game.user.id,
        speaker: { alias: game.i18n.localize("NFT.ReconnectResync.Speaker") },
        whisper: [...recipients],
        // Fallback text for when the module is turned off; replaced at render time
        content: `<p>${fallback}</p>`,
        flags: {
            [MODULE_ID]: {
                [FLAG]: { userId: game.user.id, duration, count, reloaded: false, ...(differences ? { differences } : {}) }
            }
        }
    });
}

/* -------------------------------------------- */
/*  GM requests                                 */
/* -------------------------------------------- */

/**
 * Ask connected users to check themselves, and show the GM a summary.
 * @param {string[]} [userIds]  Users to check (default: everyone connected)
 * @returns {Promise<Record<string, "ok"|"drift"|"error"|"noAnswer">|null>}  Status by user id
 */
export async function requestSyncCheck(userIds) {
    if (!game.user.isGM) return null;
    const targets = (userIds ?? game.users.filter(u => u.active).map(u => u.id)).filter(id => game.users.get(id)?.active);
    if (!targets.length) return {};
    ui.notifications.info("NFT.SyncCheck.Checking", { localize: true });

    const others = targets.filter(id => id !== game.user.id);
    const results = {};
    const answers = new Promise(resolve => {
        if (!others.length) return resolve();
        const requestId = foundry.utils.randomID();
        const timer = setTimeout(() => {
            _pendingRequests.delete(requestId);
            resolve();
        }, REPLY_TIMEOUT_MS);
        _pendingRequests.set(requestId, (userId, status) => {
            if (!others.includes(userId)) return;
            results[userId] = status;
            if (others.some(id => !(id in results))) return;
            clearTimeout(timer);
            _pendingRequests.delete(requestId);
            resolve();
        });
        game.socket.emit(`module.${MODULE_ID}`, { action: "syncCheckRequest", requestId }, { recipients: others });
    });
    if (targets.includes(game.user.id)) results[game.user.id] = (await checkSync()).status;
    await answers;
    for (const id of targets) results[id] ??= "noAnswer";
    _showSummary(results);
    return results;
}

/**
 * @param {Record<string, string>} results
 */
function _showSummary(results) {
    const names = status => Object.entries(results).filter(([, s]) => s === status)
        .map(([id]) => game.users.get(id)?.name ?? id).join(", ");
    const parts = [["drift", "NFT.SyncCheck.SummaryDrift"], ["noAnswer", "NFT.SyncCheck.SummaryNoAnswer"], ["error", "NFT.SyncCheck.SummaryError"]]
        .filter(([status]) => names(status))
        .map(([status, key]) => game.i18n.format(key, { names: names(status) }));
    if (parts.length) ui.notifications.warn(`${game.i18n.localize("NFT.SyncCheck.SummaryPrefix")} ${parts.join(" ")}`);
    else ui.notifications.info(game.i18n.format("NFT.SyncCheck.SummaryOk", { count: Object.keys(results).length }));
}

/**
 * Route this feature's module socket messages.
 * @param {object} data
 * @param {string} senderId  Set by the server
 */
export function onSyncCheckSocket(data, senderId) {
    if (data?.action === "syncCheckReply") {
        _pendingRequests.get(data.requestId)?.(senderId, data.status);
        return;
    }
    if ((data?.action !== "syncCheckRequest") || !game.users.get(senderId)?.isGM) return;
    if (!getSetting("enableReconnectResync")) return;
    checkSync().then(({ status }) => {
        game.socket.emit(`module.${MODULE_ID}`, { action: "syncCheckReply", requestId: data.requestId, status }, { recipients: [senderId] });
    });
}

/* -------------------------------------------- */
/*  Setup                                       */
/* -------------------------------------------- */

/** Hooks that must exist before core builds the chat log and the Players list. Called in `setup`. */
export function initSyncCheckHooks() {
    Hooks.on("renderChatMessageHTML", _onRenderChatMessage);
    Hooks.on("getUserContextOptions", _addContextOptions);
}

/** Start watching the connection. Called in `ready`. */
export function initSyncCheck() {
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
        debug(`Sync Check: reconnected after ${(duration / 1000).toFixed(1)}s, checking.`);
        setTimeout(() => checkSync({ duration }), CHECK_DELAY_MS);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            _hiddenAt = Date.now();
            return;
        }
        const hiddenFor = _hiddenAt ? Date.now() - _hiddenAt : 0;
        _hiddenAt = 0;
        if ((hiddenFor < WAKE_AFTER_MS) || !game.socket.connected || !getSetting("enableReconnectResync")) return;
        debug(`Sync Check: tab visible again after ${Math.round(hiddenFor / 1000)}s, checking.`);
        checkSync();
    });
}

/**
 * Add the GM's entries to the Players list.
 * @param {Application} _app
 * @param {object[]} options
 */
function _addContextOptions(_app, options) {
    const canCheck = () => game.user.isGM && getSetting("enableReconnectResync");
    options.push({
        label: "NFT.SyncCheck.MenuUser",
        icon: "fa-solid fa-arrows-rotate",
        visible: li => canCheck() && Boolean(game.users.get(li.dataset.userId)?.active),
        onClick: (_event, li) => requestSyncCheck([li.dataset.userId])
    }, {
        label: "NFT.SyncCheck.MenuAll",
        icon: "fa-solid fa-users-rectangle",
        visible: () => canCheck(),
        onClick: () => requestSyncCheck()
    });
}

/* -------------------------------------------- */
/*  Message                                     */
/* -------------------------------------------- */

/**
 * What differs in one document, for the viewer.
 * @param {{data: boolean, items: number, effects: number}} difference
 * @returns {string}
 */
function _describeParts({ data, items, effects }) {
    const parts = [];
    if (effects) parts.push(game.i18n.format("NFT.SyncCheck.PartEffects", { count: effects }));
    if (items) parts.push(game.i18n.format("NFT.SyncCheck.PartItems", { count: items }));
    if (data) parts.push(game.i18n.localize("NFT.SyncCheck.PartData"));
    return parts.join(", ");
}

/**
 * The list of differing documents this viewer may see named.
 * @param {object[]} differences
 * @returns {HTMLElement}
 */
function _buildDetails(differences) {
    const lines = [];
    let others = 0;
    for (const difference of differences) {
        const doc = fromUuidSync(difference.uuid, { strict: false });
        if (!game.user.isGM && !doc?.isOwner) {
            others++;
            continue;
        }
        if (lines.length >= MAX_LINES) {
            others++;
            continue;
        }
        const name = doc?.name ?? game.i18n.localize("NFT.SyncCheck.UnknownDocument");
        lines.push(`${name}: ${_describeParts(difference)}`);
    }
    const list = document.createElement("ul");
    list.classList.add("nft-reconnect-resync-list");
    for (const line of lines) {
        const item = document.createElement("li");
        item.textContent = line;
        list.append(item);
    }
    if (others) {
        const item = document.createElement("li");
        item.textContent = game.i18n.format(lines.length ? "NFT.SyncCheck.More" : "NFT.SyncCheck.Documents", { count: others });
        list.append(item);
    }
    return list;
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
    const hasDifferences = Array.isArray(flag.differences);
    const seconds = (Number(flag.duration) / 1000).toFixed(1);

    const box = document.createElement("div");
    box.classList.add("nft-reconnect-resync");

    const body = document.createElement("p");
    if (hasDifferences) {
        body.textContent = game.i18n.format(isSelf ? "NFT.SyncCheck.BodySelf" : "NFT.SyncCheck.Body", { name });
    } else {
        body.textContent = isSelf
            ? game.i18n.format("NFT.ReconnectResync.BodySelf", { seconds })
            : game.i18n.format("NFT.ReconnectResync.Body", { name, seconds });
    }
    box.append(body);

    if (hasDifferences) {
        box.append(_buildDetails(flag.differences));
    } else if (Number(flag.count) > 1) {
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
        log("Sync Check: could not mark the message as reloaded.", err);
    }
    window.location.reload();
}
