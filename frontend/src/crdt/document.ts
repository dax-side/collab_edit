import { type Char, type CharId, type DeleteOp, type InsertOp, type Op, charIdKey, compareCharIds } from './types';

export class CRDTDocument {
  private chars: Char[] = [];
  private idIndex: Map<string, number> = new Map();

  insert(op: InsertOp): void {
    const key = charIdKey(op.char.id);
    if (this.idIndex.has(key)) return;
    const idx = this.findInsertionIndex(op.char);
    this.chars.splice(idx, 0, { ...op.char });
    this.rebuildIndex();
  }

  delete(op: DeleteOp): void {
    const key = charIdKey(op.id);
    const idx = this.idIndex.get(key);
    if (idx === undefined) return;
    if (!this.chars[idx].deleted) {
      this.chars[idx] = { ...this.chars[idx], deleted: true };
    }
  }

  apply(op: Op): void {
    if (op.type === 'insert') this.insert(op);
    else this.delete(op);
  }

  getText(): string {
    return this.chars.filter(c => !c.deleted).map(c => c.value).join('');
  }

  getVisibleChars(): Char[] {
    return this.chars.filter(c => !c.deleted);
  }

  getAfterIdAt(pos: number): CharId | null {
    const visible = this.getVisibleChars();
    if (pos === 0) return null;
    return visible[pos - 1]?.id ?? null;
  }

  getIdAt(pos: number): CharId | null {
    const visible = this.getVisibleChars();
    return visible[pos]?.id ?? null;
  }

  private findInsertionIndex(newChar: Char): number {
    let anchorIndex: number;
    if (newChar.after === null) {
      anchorIndex = 0;
    } else {
      const afterKey = charIdKey(newChar.after);
      const afterIdx = this.idIndex.get(afterKey);
      anchorIndex = afterIdx !== undefined ? afterIdx + 1 : this.chars.length;
    }

    let i = anchorIndex;
    while (i < this.chars.length) {
      const existing = this.chars[i];
      if (!sameAfter(existing.after, newChar.after)) break;
      if (compareCharIds(existing.id, newChar.id) >= 0) break;
      i++;
    }
    return i;
  }

  private rebuildIndex(): void {
    this.idIndex.clear();
    for (let i = 0; i < this.chars.length; i++) {
      this.idIndex.set(charIdKey(this.chars[i].id), i);
    }
  }
}

function sameAfter(a: CharId | null, b: CharId | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.clientId === b.clientId && a.seq === b.seq;
}
