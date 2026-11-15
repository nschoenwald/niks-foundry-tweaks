/**
 * Feature: Copy & Move to Folder
 * Description: Adds "Copy to Folder…" and "Move to Folder…" to the right-click menu of documents in the sidebar
 * directories (scenes, actors, items, journals, roll tables, cards, playlists, macros) and in unlocked compendiums.
 * Both open a dialog with the directory's folder tree.
 *
 * @introduced v14.4.0
 */
import { log, debug, isFeatureActive } from "../../context.js";

/** Document types whose directories get the entries (each fires `get<Type>ContextOptions`). */
const DOCUMENT_TYPES = ["Actor", "Adventure", "Cards", "Item", "JournalEntry", "Macro", "Playlist", "RollTable", "Scene"];

/** Value of the "No Folder" choice in the dialog. */
const ROOT = "";

let _registered = false;

export function initFolderCopyMove() {
    // Registered unconditionally once; the entries check the settings each time the menu opens,
    // so toggling the feature needs no reload or directory re-render.
    if (_registered) return;
    _registered = true;
    for (const type of DOCUMENT_TYPES) {
        Hooks.on(`get${type}ContextOptions`, _addEntries);
    }
    debug("Copy & Move to Folder: context menu hooks registered");
}

/**
 * @returns {boolean}
 */
function _active() {
    return isFeatureActive("enableFolderCopyMove", "clientEnableFolderCopyMove");
}

/**
 * Add the two entries to a directory's (or compendium's) document context menu.
 * @param {foundry.applications.sidebar.DocumentDirectory} app
 * @param {ContextMenuEntry[]} menuItems
 */
function _addEntries(app, menuItems) {
    const collection = app.collection;
    if (!collection?.folders || !Array.isArray(menuItems)) return;
    const isPack = collection instanceof foundry.documents.collections.CompendiumCollection;

    /** Source data (index entry in a pack) of the clicked document. */
    const getEntry = li => {
        const id = li.closest("[data-entry-id]")?.dataset.entryId;
        return isPack ? collection.index.get(id) : collection.get(id);
    };
    const getDocument = async li => {
        const id = li.closest("[data-entry-id]")?.dataset.entryId;
        return isPack ? collection.getDocument(id) : collection.get(id);
    };
    const currentFolderId = entry => (entry?.folder?.id ?? entry?.folder ?? null);

    const canMove = li => {
        if (!_active() || !collection.folders.size) return false;
        if (isPack) return game.user.isGM && !collection.locked;
        return !!getEntry(li)?.canUserModify(game.user, "update");
    };
    const canCopy = li => {
        if (!_active() || !collection.folders.size) return false;
        if (isPack) return game.user.isGM && !collection.locked;
        const doc = getEntry(li);
        return !!doc?.isOwner && app.documentClass.canUserCreate(game.user);
    };

    const moveEntry = {
        label: "NFT.FolderCopyMove.Move",
        icon: "fa-solid fa-folder-tree",
        visible: canMove,
        onClick: async (_event, li) => {
            const doc = await getDocument(li);
            if (!doc) return;
            const target = await _pickFolder(collection, doc, "move", currentFolderId(doc));
            if (target === undefined) return;
            await doc.update({ folder: target });
            _notify("NFT.FolderCopyMove.Moved", doc.name, collection, target);
        }
    };

    const copyEntry = {
        label: "NFT.FolderCopyMove.Copy",
        icon: "fa-regular fa-copy",
        visible: canCopy,
        onClick: async (_event, li) => {
            const original = await getDocument(li);
            if (!original) return;
            const sourceFolder = currentFolderId(original);
            const target = await _pickFolder(collection, original, "copy", sourceFolder);
            if (target === undefined) return;

            // Same preparation as core's Duplicate (e.g. playlists stop playing). "Copy of …" only when the copy
            // lands next to the original; in another folder it keeps the original name.
            const data = isPack ? {} : (app._prepareDuplicateData?.(original) ?? {});
            if (target === sourceFolder) data.name ??= _loc("DOCUMENT.CopyOf", { name: original._source.name });
            else data.name = original._source.name;
            data.folder = target;

            const copy = await original.clone(data, { save: true, addSource: true, discardInvalidEmbedded: true });
            if (copy) _notify("NFT.FolderCopyMove.Copied", copy.name, collection, target);
        }
    };

    // Move next to core's "Remove from Folder", Copy after "Duplicate"; at the end where those don't exist.
    _insertAfter(menuItems, "FOLDER.Clear", moveEntry, -1);
    _insertAfter(menuItems, "SIDEBAR.Duplicate", copyEntry, 0);
}

/**
 * Insert an entry relative to the entry with the given label, or append it.
 * @param {ContextMenuEntry[]} menuItems
 * @param {string} label       Label of the reference entry
 * @param {ContextMenuEntry} entry
 * @param {number} offset      0 inserts after the reference, -1 before it
 */
function _insertAfter(menuItems, label, entry, offset) {
    const index = menuItems.findIndex(item => item.label === label);
    if (index === -1) menuItems.push(entry);
    else menuItems.splice(index + 1 + offset, 0, entry);
}

/**
 * The folders of a collection in directory order, depth-first.
 * @param {DocumentCollection} collection
 * @returns {{folder: Folder, depth: number}[]}
 */
function _folderList(collection) {
    const result = [];
    const walk = node => {
        for (const child of node.children ?? []) {
            if (!child.folder) continue;
            result.push({ folder: child.folder, depth: child.depth });
            walk(child);
        }
    };
    walk(collection.tree);
    return result;
}

/**
 * Ask for the target folder.
 * @param {DocumentCollection} collection
 * @param {ClientDocument} doc
 * @param {"copy"|"move"} mode
 * @param {string|null} currentId     The document's current folder
 * @returns {Promise<string|null|undefined>}  Folder id, null for no folder, undefined when cancelled
 */
async function _pickFolder(collection, doc, mode, currentId) {
    const escape = foundry.utils.escapeHTML;
    const isMove = mode === "move";
    const options = [{ value: ROOT, label: _loc("NFT.FolderCopyMove.NoFolder"), depth: 1, current: currentId === null }];
    for (const { folder, depth } of _folderList(collection)) {
        options.push({ value: folder.id, label: folder.name, depth, current: folder.id === currentId });
    }

    // Moving into the current folder does nothing, so it can't be picked; preselect the first real target.
    const firstEnabled = options.find(o => !(isMove && o.current))?.value;
    if (firstEnabled === undefined) return undefined;
    const selected = isMove ? firstEnabled : (currentId ?? ROOT);

    const optionsHtml = options.map(o => {
        const indent = "   ".repeat(Math.max(0, o.depth - 1));
        const suffix = o.current ? ` ${_loc("NFT.FolderCopyMove.CurrentSuffix")}` : "";
        const disabled = isMove && o.current ? " disabled" : "";
        const sel = o.value === selected ? " selected" : "";
        return `<option value="${o.value}"${disabled}${sel}>${indent}${escape(o.label)}${escape(suffix)}</option>`;
    }).join("");

    const hint = isMove ? "NFT.FolderCopyMove.MoveHint" : "NFT.FolderCopyMove.CopyHint";
    const content = `
        <p>${escape(_loc(hint, { name: doc.name }))}</p>
        <div class="form-group">
            <label>${escape(_loc("NFT.FolderCopyMove.Folder"))}</label>
            <div class="form-fields">
                <select name="folder" autofocus>${optionsHtml}</select>
            </div>
        </div>`;

    const result = await foundry.applications.api.DialogV2.input({
        window: {
            title: _loc(isMove ? "NFT.FolderCopyMove.MoveTitle" : "NFT.FolderCopyMove.CopyTitle", { name: doc.name }),
            icon: isMove ? "fa-solid fa-folder-tree" : "fa-regular fa-copy"
        },
        classes: ["nft-folder-copy-move"],
        position: { width: 420 },
        content,
        ok: {
            label: isMove ? "NFT.FolderCopyMove.MoveButton" : "NFT.FolderCopyMove.CopyButton",
            icon: isMove ? "fa-solid fa-folder-tree" : "fa-regular fa-copy"
        }
    });
    if (!result) return undefined;
    const value = result.folder;
    return value ? value : null;
}

/**
 * @param {string} key
 * @param {string} name
 * @param {DocumentCollection} collection
 * @param {string|null} folderId
 */
function _notify(key, name, collection, folderId) {
    const folder = folderId ? collection.folders.get(folderId)?.name : _loc("NFT.FolderCopyMove.NoFolder");
    ui.notifications.info(_loc(key, { name, folder: folder ?? "" }));
    log(`Copy & Move to Folder: ${key.split(".").pop()} "${name}" → ${folder}`);
}
