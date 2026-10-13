export type ModuleId = "overview" | "manifest" | "inspector" | "output" | "prompts" | "regression" | "chaos";
export type ReportKind = "manifest" | "output" | "prompt" | "regression" | "chaos" | "inspector";

export interface WorkbenchProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  activeModule: ModuleId;
  manifestSource: string;
}

export interface WorkbenchReport {
  id: string;
  kind: ReportKind;
  title: string;
  createdAt: string;
  projectId: string | null;
  summary: string;
  payload: unknown;
}

export interface WorkbenchSettings {
  confirmBeforeImport: boolean;
  keepReportHistory: boolean;
  reportHistoryLimit: number;
  compactCards: boolean;
}

export interface WorkbenchState {
  schemaVersion: 1;
  projects: WorkbenchProject[];
  reports: WorkbenchReport[];
  settings: WorkbenchSettings;
  selectedProjectId: string;
}

export const WORKBENCH_STORAGE_KEY = "devforge.workbench.v1";
export const WORKBENCH_EXPORT_KIND = "devforge-workbench-export";
export const DEFAULT_SETTINGS: WorkbenchSettings = {
  confirmBeforeImport: true,
  keepReportHistory: true,
  reportHistoryLimit: 25,
  compactCards: false
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const id = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `df-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function createProject(name = "Untitled project"): WorkbenchProject {
  const now = new Date().toISOString();
  return {
    id: id(),
    name: name.trim().slice(0, 80) || "Untitled project",
    description: "",
    createdAt: now,
    updatedAt: now,
    activeModule: "manifest",
    manifestSource: JSON.stringify({
      manifest_version: 3, name: "My Extension", version: "1.0.0",
      description: "A sample extension to inspect", action: { default_title: "Open extension" },
      permissions: ["storage"], host_permissions: []
    }, null, 2)
  };
}

export function createDefaultState(): WorkbenchState {
  const project = createProject("My first project");
  return {
    schemaVersion: 1,
    projects: [project],
    reports: [],
    settings: { ...DEFAULT_SETTINGS },
    selectedProjectId: project.id
  };
}

export function isWorkbenchState(value: unknown): value is WorkbenchState {
  if (!isObject(value) || value.schemaVersion !== 1 || !Array.isArray(value.projects) || !Array.isArray(value.reports) || !isObject(value.settings)) return false;
  const projectsOkay = value.projects.every((project) => isObject(project)
    && typeof project.id === "string" && typeof project.name === "string"
    && typeof project.description === "string" && typeof project.createdAt === "string"
    && typeof project.updatedAt === "string" && typeof project.manifestSource === "string"
    && ["overview", "manifest", "inspector", "output", "prompts", "regression", "chaos"].includes(String(project.activeModule)));
  const reportsOkay = value.reports.every((report) => isObject(report)
    && typeof report.id === "string" && typeof report.title === "string"
    && typeof report.createdAt === "string" && typeof report.summary === "string"
    && typeof report.kind === "string" && ["manifest", "output", "prompt", "regression", "chaos", "inspector"].includes(report.kind));
  const settings = value.settings;
  return projectsOkay && reportsOkay
    && typeof settings.confirmBeforeImport === "boolean"
    && typeof settings.keepReportHistory === "boolean"
    && typeof settings.compactCards === "boolean"
    && typeof settings.reportHistoryLimit === "number"
    && settings.reportHistoryLimit >= 0 && settings.reportHistoryLimit <= 250
    && typeof value.selectedProjectId === "string";
}

export function normalizeWorkbenchState(value: unknown): WorkbenchState {
  if (!isWorkbenchState(value)) throw new Error("This file is not a supported DevForge Workbench export (schema version 1).");
  const projectIds = new Set(value.projects.map((project) => project.id));
  const projects = value.projects.length ? value.projects : createDefaultState().projects;
  const selectedProjectId = projectIds.has(value.selectedProjectId) ? value.selectedProjectId : projects[0]!.id;
  const limit = Math.max(0, Math.min(250, Math.floor(value.settings.reportHistoryLimit)));
  return {
    schemaVersion: 1,
    projects: projects.map((project) => ({ ...project, name: project.name.trim().slice(0, 80) || "Untitled project" })),
    reports: value.settings.keepReportHistory ? value.reports.slice(0, limit || value.reports.length) : [],
    settings: { ...DEFAULT_SETTINGS, ...value.settings, reportHistoryLimit: limit },
    selectedProjectId
  };
}

export function exportWorkbenchState(state: WorkbenchState): string {
  return JSON.stringify({
    kind: WORKBENCH_EXPORT_KIND,
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    data: state
  }, null, 2);
}

export function parseWorkbenchImport(source: string): WorkbenchState {
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new Error("The selected file is not valid JSON."); }
  if (!isObject(parsed) || parsed.kind !== WORKBENCH_EXPORT_KIND || parsed.schemaVersion !== 1) {
    throw new Error("This JSON is not a DevForge Workbench export from schema version 1.");
  }
  return normalizeWorkbenchState(parsed.data);
}

export function loadWorkbenchState(storage?: Pick<Storage, "getItem">): WorkbenchState {
  try {
    const target = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
    const raw = target?.getItem(WORKBENCH_STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed: unknown = JSON.parse(raw);
    return normalizeWorkbenchState(parsed);
  } catch {
    return createDefaultState();
  }
}

export function saveWorkbenchState(state: WorkbenchState, storage?: Pick<Storage, "setItem">): boolean {
  try {
    const target = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
    if (!target) return false;
    target.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function makeReport(input: Omit<WorkbenchReport, "id" | "createdAt">): WorkbenchReport {
  return { ...input, id: id(), createdAt: new Date().toISOString() };
}
