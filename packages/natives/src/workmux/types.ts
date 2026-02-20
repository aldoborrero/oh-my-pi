/**
 * Types for workmux terminal multiplexer + git worktree orchestration.
 */

/** Detected terminal multiplexer backend. */
export type WorkmuxBackend = "Tmux" | "WezTerm" | "Kitty";

/** Agent status for workmux dashboard. */
export type WorkmuxAgentStatus = "Working" | "Waiting" | "Done";

/** Information about the current workmux environment. */
export interface WorkmuxEnvironment {
	/** Detected backend type. */
	backend: WorkmuxBackend;
	/** Whether the multiplexer server is running. */
	isRunning: boolean;
	/** Current pane ID if inside a multiplexer pane. */
	paneId: string | null;
}

/** Agent state information from workmux state store. */
export interface WorkmuxAgentInfo {
	/** Pane identifier. */
	paneId: string;
	/** Working directory path. */
	workdir: string;
	/** Current status if set. */
	status: WorkmuxAgentStatus | null;
	/** Pane title if set. */
	title: string | null;
	/** Unix timestamp of last status change. */
	statusTs: number | null;
}

/** Parameters for creating a new multiplexer window. */
export interface WorkmuxCreateWindowParams {
	/** Window name prefix (e.g., "swarm-"). */
	prefix: string;
	/** Window name (without prefix). */
	name: string;
	/** Working directory for the window. */
	cwd: string;
	/** Optional window ID to insert after (for ordering). */
	afterWindow?: string | null;
}

declare module "../bindings" {
	/** Native workmux operations exposed by the bindings layer. */
	interface NativeBindings {
		/**
		 * Create a new multiplexer window/tab.
		 * @param params - Window creation parameters
		 * @returns The pane ID of the newly created window.
		 */
		workmuxCreateWindow(params: WorkmuxCreateWindowParams): Promise<string>;

		/**
		 * Detect the terminal multiplexer backend and check if it's running.
		 * @returns Environment info including backend type, running status, and current pane ID.
		 */
		workmuxDetectEnvironment(): Promise<WorkmuxEnvironment>;

		/**
		 * Check if workmux multiplexer is available and running.
		 * @returns `true` if a supported multiplexer (tmux, wezterm, kitty) is running.
		 */
		workmuxIsAvailable(): Promise<boolean>;

		/**
		 * Get the current pane ID if running inside a multiplexer.
		 * @returns Pane ID string or `null` if not inside a multiplexer pane.
		 */
		workmuxCurrentPaneId(): Promise<string | null>;

		/**
		 * Set the agent status for the current pane in workmux dashboard.
		 * @param status - Agent status (Working, Waiting, Done)
		 * @param title - Optional pane title override
		 */
		workmuxSetAgentStatus(status: WorkmuxAgentStatus, title?: string | null): Promise<void>;

		/**
		 * Clear the agent status for the current pane.
		 */
		workmuxClearAgentStatus(): Promise<void>;

		/**
		 * List all tracked agents from the workmux state store.
		 * @returns Array of agent info objects.
		 */
		workmuxListAgents(): Promise<WorkmuxAgentInfo[]>;

		/**
		 * Send keys (command) to a specific pane.
		 * @param paneId - Target pane identifier
		 * @param keys - Keys/command to send
		 */
		workmuxSendKeys(paneId: string, keys: string): Promise<void>;

		/**
		 * Capture terminal output from a pane.
		 * @param paneId - Target pane identifier
		 * @param lines - Number of lines to capture (default: 50)
		 * @returns Captured terminal content or `null` if capture fails.
		 */
		workmuxCapturePane(paneId: string, lines?: number | null): Promise<string | null>;

		/**
		 * Check if a window with the given name exists.
		 * @param prefix - Window name prefix (e.g., "wm-")
		 * @param name - Window name (without prefix)
		 * @returns `true` if the window exists.
		 */
		workmuxWindowExists(prefix: string, name: string): Promise<boolean>;

		/**
		 * Select (focus) a window by name.
		 * @param prefix - Window name prefix
		 * @param name - Window name (without prefix)
		 */
		workmuxSelectWindow(prefix: string, name: string): Promise<void>;

		/**
		 * Kill a window by its full name.
		 * @param fullName - Complete window name including prefix
		 */
		workmuxKillWindow(fullName: string): Promise<void>;
	}
}
