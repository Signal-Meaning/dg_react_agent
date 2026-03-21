/**
 * Managed prompt env for real-API integration (Issue #539).
 * Used when OPENAI_MANAGED_PROMPT_ID is set to qualify live session.prompt acceptance.
 */

export type ManagedPromptFromEnv = {
  id: string;
  version?: string;
  variables?: Record<string, unknown>;
};

const VAR_NAME = 'OPENAI_MANAGED_PROMPT_VARIABLES';

/**
 * Read managed prompt fields from process.env.
 * @returns `undefined` when OPENAI_MANAGED_PROMPT_ID is unset or blank (after trim) — caller should skip the test.
 * @throws if OPENAI_MANAGED_PROMPT_VARIABLES is set but not valid JSON object (integrator misconfiguration).
 */
export function parseManagedPromptFromEnv(env: NodeJS.ProcessEnv = process.env): ManagedPromptFromEnv | undefined {
  const id = env.OPENAI_MANAGED_PROMPT_ID?.trim();
  if (!id) return undefined;

  const versionRaw = env.OPENAI_MANAGED_PROMPT_VERSION?.trim();
  const version = versionRaw && versionRaw.length > 0 ? versionRaw : undefined;

  const varsRaw = env.OPENAI_MANAGED_PROMPT_VARIABLES?.trim();
  if (!varsRaw) {
    return version ? { id, version } : { id };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(varsRaw);
  } catch {
    throw new Error(
      `${VAR_NAME} must be valid JSON. Received a value but JSON.parse failed. Omit the variable to run without template variables.`
    );
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${VAR_NAME} must be a JSON object (e.g. {"key":"value"}), not an array or primitive.`);
  }

  const variables = parsed as Record<string, unknown>;
  return version ? { id, version, variables } : { id, variables };
}
