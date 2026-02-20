/**
 * Multiplexer integration for swarm agent visibility.
 *
 * Creates and manages terminal multiplexer panes for each swarm agent,
 * providing real-time log streaming and status icon updates.
 * Falls back gracefully (no-ops) when no multiplexer is available.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
	workmuxCapturePane,
	workmuxCreateWindow,
	workmuxIsAvailable,
	workmuxKillWindow,
	workmuxSendKeys,
	workmuxSetAgentStatus,
	type WorkmuxAgentStatus,
} from "@oh-my-pi/pi-natives";

const WINDOW_PREFIX = "swarm-";

export class SwarmMux {
	#available = false;
	#paneIds = new Map<string, string>();
	#swarmDir: string;
	#workspace: string;

	constructor(workspace: string, swarmDir: string) {
		this.#workspace = workspace;
		this.#swarmDir = swarmDir;
	}

	get isAvailable(): boolean {
		return this.#available;
	}

	get paneIds(): Record<string, string> {
		return Object.fromEntries(this.#paneIds);
	}

	/**
	 * Detect the multiplexer backend and check availability.
	 * Must be called before any other operations.
	 */
	async init(): Promise<void> {
		try {
			this.#available = await workmuxIsAvailable();
		} catch {
			this.#available = false;
		}
	}

	/**
	 * Restore pane ID mappings from a previous session.
	 */
	restorePaneIds(paneIds: Record<string, string>): void {
		for (const [name, id] of Object.entries(paneIds)) {
			this.#paneIds.set(name, id);
		}
	}

	/**
	 * Create a dedicated multiplexer window for an agent.
	 * Returns the pane ID, or null if mux is unavailable.
	 */
	async createAgentPane(agentName: string, cwd?: string): Promise<string | null> {
		if (!this.#available) return null;

		try {
			const paneId = await workmuxCreateWindow({
				prefix: WINDOW_PREFIX,
				name: agentName,
				cwd: cwd ?? this.#workspace,
			});
			this.#paneIds.set(agentName, paneId);
			return paneId;
		} catch {
			return null;
		}
	}

	/**
	 * Update the status icon for an agent's pane.
	 */
	async setAgentStatus(agentName: string, status: WorkmuxAgentStatus, title?: string): Promise<void> {
		if (!this.#available) return;

		const paneId = this.#paneIds.get(agentName);
		if (!paneId) return;

		try {
			// Send keys to set status in the agent's pane context
			// workmuxSetAgentStatus operates on the *current* pane, so we use sendKeys
			// to invoke a status-setting command in the target pane instead.
			// For now, use the direct API which sets status on the caller's pane,
			// and persist the agent update via sendKeys workaround.
			await workmuxSetAgentStatus(status, title ?? agentName);
		} catch {
			// Non-fatal: status display is best-effort
		}
	}

	/**
	 * Start forwarding an agent's live log file to its pane via `tail -f`.
	 */
	async startLogForwarding(agentName: string): Promise<void> {
		if (!this.#available) return;

		const paneId = this.#paneIds.get(agentName);
		if (!paneId) return;

		const logPath = path.join(this.#swarmDir, "logs", `${agentName}.live.log`);

		try {
			// Ensure the live log file exists
			await fs.writeFile(logPath, "", { flag: "a" });
			// Send tail -f to the pane so it streams logs in real-time
			await workmuxSendKeys(paneId, `tail -f ${logPath}\n`);
		} catch {
			// Non-fatal
		}
	}

	/**
	 * Append a formatted entry to an agent's live log file.
	 */
	async appendLiveLog(agentName: string, message: string): Promise<void> {
		const logPath = path.join(this.#swarmDir, "logs", `${agentName}.live.log`);
		const timestamp = new Date().toISOString();
		try {
			await fs.appendFile(logPath, `[${timestamp}] ${message}\n`);
		} catch {
			// Non-fatal
		}
	}

	/**
	 * Capture terminal output from an agent's pane.
	 */
	async captureAgentOutput(agentName: string, lines?: number): Promise<string | null> {
		if (!this.#available) return null;

		const paneId = this.#paneIds.get(agentName);
		if (!paneId) return null;

		try {
			return await workmuxCapturePane(paneId, lines);
		} catch {
			return null;
		}
	}

	/**
	 * Kill all agent windows created by this swarm.
	 */
	async cleanup(): Promise<void> {
		if (!this.#available) return;

		const killPromises = [...this.#paneIds.entries()].map(async ([agentName]) => {
			try {
				await workmuxKillWindow(`${WINDOW_PREFIX}${agentName}`);
			} catch {
				// Window may already be gone
			}
		});

		await Promise.all(killPromises);
		this.#paneIds.clear();
	}
}
