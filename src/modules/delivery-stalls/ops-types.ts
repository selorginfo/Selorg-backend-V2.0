export type Tone = 'green' | 'amber' | 'blue' | 'red' | 'grey';

export type Cell = string | { label: string; tone: Tone };

export type Row = Cell[];

export interface OpsActionEffect {
  status?: [string, Tone] | ((values: Record<string, string>) => [string, Tone]);
  set?: Record<number, (values: Record<string, string>, row: Row) => string>;
  remove?: boolean;
}

export interface OpsLogEntry {
  id: string;
  action: string;
  by: string;
  at: string;
  note?: string;
}

export interface OpsRouteState {
  rows: Record<string, Row[]>;
  stage: Record<string, number>;
  log: Record<string, OpsLogEntry[]>;
}

export interface FlowStep {
  label: string;
  actor: string;
}

export interface KpiStat {
  value: string;
  label: string;
  color?: string;
}

export interface ActionField {
  id: string;
  label: string;
  kind: string;
  options: string[];
  required: boolean;
}

export interface ActionForm {
  advances: boolean;
  fields: ActionField[];
}

export interface ScreenSeed {
  id: string;
  title: string;
  entity: string;
  cap: string;
  tabs: string[];
  columns: string[];
  flow: FlowStep[];
  flowAt: number | null;
  kpis: KpiStat[];
  actions: string[];
  rows: Record<string, Row[]>;
}

export interface FlatRecord {
  id: string;
  status: { label: string; tone: Tone };
  stage: number;
  activity: OpsLogEntry[];
  [key: string]: unknown;
}
