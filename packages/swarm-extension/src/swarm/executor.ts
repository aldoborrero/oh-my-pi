/**
 * Swarm agent execution via oh-my-pi's subagent infrastructure.
 *
 * Wraps `runSubprocess` to spawn individual swarm agents with full tool access.
 * Each agent runs in the swarm workspace with its task instructions as the user prompt.
 */
import * as path from "node:path";
import type {
	AgentDefinition,
	AgentProgress,
	AgentSource,
	AuthStorage,
	ModelRegistry,
	Settings,
	SingleResult,
} from "@oh-my-pi/pi-coding-agent";
import { runSubprocess } from "@oh-my-pi/pi-coding-agent";
import type { SwarmMux } from "./mux";
import type { SwarmAgent } from "./schema";
import type { StateTracker } from "./state";

export interface SwarmExecutorOptions {
	workspace: string;
	swarmName: string;
	iteration: number;
	modelOverride?: string;
	signal?: AbortSignal;
	onProgress?: (agentName: string, progress: AgentProgress) => void;
	authStorage?: AuthStorage;
	modelRegistry?: ModelRegistry;
	settings?: Settings;
	stateTracker: StateTracker;
	mux?: SwarmMux;
}

/**
 * Execute a single swarm agent as an oh-my-pi subagent.
 *
 * The agent receives:
 * - System prompt: built from role + extra_context
 * - User prompt (task): the full task instructions from the YAML
 * - Working directory: the swarm workspace
 * - Full tool access (bash, python, read, write, edit, grep, find, fetch, web_search, browser)
 */
export async function executeSwarmAgent(
	agent: SwarmAgent,
	index: number,
	options: SwarmExecutorOptions,
): Promise<SingleResult> {
	const {
		workspace,
		swarmName,
		iteration,
		modelOverride,
		signal,
		onProgress,
		authStorage,
		modelRegistry,
		settings,
		stateTracker,
		mux,
	} = options;

	const agentId = `swarm-${swarmName}-${agent.name}-${iteration}`;

	const agentDef: AgentDefinition = {
		name: agent.name,
		description: `Swarm agent: ${agent.role}`,
		systemPrompt: buildSystemPrompt(agent),
		source: "project" as AgentSource,
	};

	await stateTracker.updateAgent(agent.name, {
		status: "running",
		iteration,
		startedAt: Date.now(),
	});
	await stateTracker.appendLog(agent.name, `Starting iteration ${iteration}`);

	// Set mux status to "Working" and start log forwarding
	if (mux?.isAvailable) {
		await mux.setAgentStatus(agent.name, "Working", `${agent.name}: ${agent.role}`);
		await mux.startLogForwarding(agent.name);
		await mux.appendLiveLog(agent.name, `Starting iteration ${iteration}`);
	}

	try {
		const result = await runSubprocess({
			cwd: workspace,
			agent: agentDef,
			task: agent.task,
			index,
			id: agentId,
			modelOverride,
			signal,
			onProgress: progress => {
				onProgress?.(agent.name, progress);
				// Forward progress to the live log for pane visibility
				if (mux?.isAvailable) {
					if (progress.currentTool) {
						mux.appendLiveLog(agent.name, `[tool] ${progress.currentTool}`);
					} else if (progress.recentOutput.length > 0) {
						const latest = progress.recentOutput[progress.recentOutput.length - 1];
						if (latest) {
							mux.appendLiveLog(agent.name, latest.slice(0, 200));
						}
					}
				}
			},
			authStorage,
			modelRegistry,
			settings,
			enableLsp: false,
			artifactsDir: path.join(stateTracker.swarmDir, "context"),
		});

		const status = result.exitCode === 0 ? ("completed" as const) : ("failed" as const);
		await stateTracker.updateAgent(agent.name, {
			status,
			completedAt: Date.now(),
			error: result.error,
		});
		await stateTracker.appendLog(
			agent.name,
			`Iteration ${iteration} ${status}${result.error ? `: ${result.error}` : ""}`,
		);

		// Update mux status on completion
		if (mux?.isAvailable) {
			const muxStatus = status === "completed" ? "Done" : "Working";
			await mux.setAgentStatus(agent.name, muxStatus, `${agent.name}: ${status}`);
			await mux.appendLiveLog(agent.name, `Iteration ${iteration} ${status}`);
		}

		return result;
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		await stateTracker.updateAgent(agent.name, {
			status: "failed",
			completedAt: Date.now(),
			error,
		});
		await stateTracker.appendLog(agent.name, `Iteration ${iteration} error: ${error}`);

		// Update mux status on failure
		if (mux?.isAvailable) {
			await mux.appendLiveLog(agent.name, `Error: ${error}`);
		}

		throw err;
	}
}

function buildSystemPrompt(agent: SwarmAgent): string {
	const parts = [`You are a ${agent.role}.`];
	if (agent.extraContext) {
		parts.push(agent.extraContext);
	}
	return parts.join("\n\n");
}
