export interface PromptTestCase {
  id: string;
  name: string;
  input: string;
  required: string[];
  forbidden: string[];
  minWords: number | null;
  maxWords: number | null;
}

export interface PromptVersion {
  id: string;
  label: string;
  prompt: string;
  createdAt: string;
}

export interface PromptRun {
  id: string;
  caseId: string;
  caseName: string;
  versionId: string;
  versionLabel: string;
  output: string;
  passed: boolean;
  findings: string[];
  createdAt: string;
}

export interface PromptLabState {
  promptName: string;
  draft: string;
  versions: PromptVersion[];
  cases: PromptTestCase[];
  runs: PromptRun[];
}

export function evaluatePromptOutput(output: string, testCase: Pick<PromptTestCase, "required" | "forbidden" | "minWords" | "maxWords">): { passed: boolean; findings: string[]; wordCount: number } {
  const words = (output.trim().match(/\S+/g) ?? []).length;
  const findings: string[] = [];
  for (const phrase of testCase.required) {
    if (phrase.trim() && !output.toLocaleLowerCase().includes(phrase.trim().toLocaleLowerCase())) findings.push(`Missing required phrase: ${phrase.trim()}`);
  }
  for (const phrase of testCase.forbidden) {
    if (phrase.trim() && output.toLocaleLowerCase().includes(phrase.trim().toLocaleLowerCase())) findings.push(`Contains forbidden phrase: ${phrase.trim()}`);
  }
  if (testCase.minWords !== null && words < testCase.minWords) findings.push(`Word count ${words} is below minimum ${testCase.minWords}`);
  if (testCase.maxWords !== null && words > testCase.maxWords) findings.push(`Word count ${words} exceeds maximum ${testCase.maxWords}`);
  return { passed: findings.length === 0, findings, wordCount: words };
}

export function createPromptLabState(): PromptLabState {
  const versionId = "prompt-v1";
  const caseId = "case-greeting";
  const prompt = "Write a friendly, concise greeting. Keep it under 30 words.";
  return {
    promptName: "Starter prompt",
    draft: prompt,
    versions: [{ id: versionId, label: "v1", prompt, createdAt: new Date().toISOString() }],
    cases: [{ id: caseId, name: "Concise greeting", input: "Greet a new teammate.", required: ["hello"], forbidden: ["guaranteed"], minWords: 1, maxWords: 30 }],
    runs: []
  };
}

export function normalizePromptLabState(value: unknown): PromptLabState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PromptLab data must be an object.");
  const candidate = value as Partial<PromptLabState>;
  if (typeof candidate.promptName !== "string" || typeof candidate.draft !== "string"
    || !Array.isArray(candidate.versions) || !Array.isArray(candidate.cases) || !Array.isArray(candidate.runs)) {
    throw new Error("PromptLab data has an unsupported shape.");
  }
  if (candidate.versions.length > 200 || candidate.cases.length > 200 || candidate.runs.length > 500) {
    throw new Error("PromptLab import exceeds the supported item limits.");
  }
  return {
    promptName: candidate.promptName.slice(0, 120),
    draft: candidate.draft.slice(0, 100_000),
    versions: candidate.versions.filter((item): item is PromptVersion => !!item && typeof item.id === "string" && typeof item.label === "string" && typeof item.prompt === "string" && typeof item.createdAt === "string"),
    cases: candidate.cases.filter((item): item is PromptTestCase => !!item && typeof item.id === "string" && typeof item.name === "string" && typeof item.input === "string" && Array.isArray(item.required) && Array.isArray(item.forbidden) && (item.minWords === null || typeof item.minWords === "number") && (item.maxWords === null || typeof item.maxWords === "number")),
    runs: candidate.runs.filter((item): item is PromptRun => !!item && typeof item.id === "string" && typeof item.caseId === "string" && typeof item.caseName === "string" && typeof item.versionId === "string" && typeof item.versionLabel === "string" && typeof item.output === "string" && typeof item.passed === "boolean" && Array.isArray(item.findings) && typeof item.createdAt === "string")
  };
}
