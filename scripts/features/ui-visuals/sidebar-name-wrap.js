/**
 * Feature: Sidebar Multi-line Names
 * Description: Allows long document names in the right sidebar directories to wrap onto multiple lines instead of being truncated with an ellipsis.
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.1.0)
 */
import { log } from "../../context.js";

export function enableSidebarNameWrap() {
    document.body.classList.add("nft-sidebar-name-wrap");
    log("Sidebar Name Wrap enabled");
}

export function disableSidebarNameWrap() {
    document.body.classList.remove("nft-sidebar-name-wrap");
    log("Sidebar Name Wrap disabled");
}
