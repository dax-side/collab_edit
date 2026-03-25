export interface CharId {
  clientId: string;
  seq: number;
}

export interface Char {
  id: CharId;
  value: string;
  deleted: boolean;
  after: CharId | null;
}

export interface InsertOp {
  type: 'insert';
  char: Char;
}

export interface DeleteOp {
  type: 'delete';
  id: CharId;
}

export type Op = InsertOp | DeleteOp;

export function charIdKey(id: CharId): string {
  return `${id.clientId}:${id.seq}`;
}

export function compareCharIds(a: CharId, b: CharId): number {
  if (a.clientId !== b.clientId) return a.clientId > b.clientId ? -1 : 1;
  return b.seq - a.seq; 
}
