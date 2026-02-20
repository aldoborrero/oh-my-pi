/**
 * Workmux: Terminal multiplexer + git worktree orchestration.
 *
 * Provides bindings for coordinating AI coding agents across
 * terminal multiplexer panes (tmux, WezTerm, Kitty).
 */

import { native } from "../native";

import type { WorkmuxAgentInfo, WorkmuxAgentStatus, WorkmuxBackend, WorkmuxCreateWindowParams, WorkmuxEnvironment } from "./types";

export type { WorkmuxAgentInfo, WorkmuxAgentStatus, WorkmuxBackend, WorkmuxCreateWindowParams, WorkmuxEnvironment } from "./types";

/**
 * Create a new multiplexer window/tab.
 *
 * @param params - Window creation parameters (prefix, name, cwd, optional afterWindow)
 * @returns The pane ID of the newly created window.
 */
export async function createWindow(params: WorkmuxCreateWindowParams): Promise<string> {
	return native.workmuxCreateWindow(params);
}

/**
 * Detect the terminal multiplexer backend and check if it's running.
 *
 * @returns Environment info including backend type, running status, and current pane ID.
 */
export async function detectEnvironment(): Promise<WorkmuxEnvironment> {
	return native.workmuxDetectEnvironment();
}

/**
 * Check if workmux multiplexer is available and running.
 *
 * @returns `true` if a supported multiplexer (tmux, wezterm, kitty) is running.
 */
export async function isAvailable(): Promise<boolean> {
	return native.workmuxIsAvailable();
}

/**
 * Get the current pane ID if running inside a multiplexer.
 *
 * @returns Pane ID string or `null` if not inside a multiplexer pane.
 */
export async function currentPaneId(): Promise<string | null> {
	return native.workmuxCurrentPaneId();
}

/**
 * Set the agent status for the current pane in workmux dashboard.
 *
 * This updates the status icon shown in the workmux dashboard and persists
 * the state for cross-session visibility.
 *
 * @param status - Agent status (Working, Waiting, Done)
 * @param title - Optional pane title override (e.g., task summary)
 */
export async function setAgentStatus(status: WorkmuxAgentStatus, title?: string): Promise<void> {
	return native.workmuxSetAgentStatus(status, title ?? null);
}

/**
 * Clear the agent status for the current pane.
 *
 * Removes the status indicator from the pane.
 */
export async function clearAgentStatus(): Promise<void> {
	return native.workmuxClearAgentStatus();
}

/**
 * List all tracked agents from the workmux state store.
 *
 * @returns Array of agent info objects.
 */
export async function listAgents(): Promise<WorkmuxAgentInfo[]> {
	return native.workmuxListAgents();
}

/**
 * Send keys (command) to a specific pane.
 *
 * @param paneId - Target pane identifier
 * @param keys - Keys/command to send
 */
export async function sendKeys(paneId: string, keys: string): Promise<void> {
	return native.workmuxSendKeys(paneId, keys);
}

/**
 * Capture terminal output from a pane.
 *
 * @param paneId - Target pane identifier
 * @param lines - Number of lines to capture (default: 50)
 * @returns Captured terminal content or `null` if capture fails.
 */
export async function capturePane(paneId: string, lines?: number): Promise<string | null> {
	return native.workmuxCapturePane(paneId, lines ?? null);
}

/**
 * Check if a window with the given name exists.
 *
 * @param prefix - Window name prefix (e.g., "wm-")
 * @param name - Window name (without prefix)
 * @returns `true` if the window exists.
 */
export async function windowExists(prefix: string, name: string): Promise<boolean> {
	return native.workmuxWindowExists(prefix, name);
}

/**
 * Select (focus) a window by name.
 *
 * @param prefix - Window name prefix
 * @param name - Window name (without prefix)
 */
export async function selectWindow(prefix: string, name: string): Promise<void> {
	return native.workmuxSelectWindow(prefix, name);
}

/**
 * Kill a window by its full name.
 *
 * @param fullName - Complete window name including prefix
 */
export async function killWindow(fullName: string): Promise<void> {
	return native.workmuxKillWindow(fullName);
}
