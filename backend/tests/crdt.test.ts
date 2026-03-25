import { CRDTDocument } from '../src/crdt/document';
import { Char, InsertOp, DeleteOp, CharId } from '../src/crdt/types';

function makeChar(clientId: string, seq: number, value: string, after: CharId | null): Char {
  return { id: { clientId, seq }, value, deleted: false, after };
}

function insertOp(clientId: string, seq: number, value: string, after: CharId | null): InsertOp {
  return { type: 'insert', char: makeChar(clientId, seq, value, after) };
}

function deleteOp(clientId: string, seq: number): DeleteOp {
  return { type: 'delete', id: { clientId, seq } };
}

describe('Basic insertion', () => {
  test('insert a single character', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'h', null));
    expect(doc.getText()).toBe('h');
  });

  test('insert multiple characters sequentially', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'h', null));
    doc.insert(insertOp('A', 2, 'i', { clientId: 'A', seq: 1 }));
    expect(doc.getText()).toBe('hi');
  });

  test('insert at beginning (after = null) pushes existing chars right', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'b', null));
    doc.insert(insertOp('A', 2, 'a', null)); 
    expect(doc.getText()).toBe('ab');
  });

  test('insert in the middle', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'a', null));
    doc.insert(insertOp('A', 2, 'c', { clientId: 'A', seq: 1 }));
    doc.insert(insertOp('A', 3, 'b', { clientId: 'A', seq: 1 })); 
    expect(doc.getText()).toBe('abc');
  });
});

describe('Deletion (tombstones)', () => {
  test('delete a character removes it from visible text', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'a', null));
    doc.insert(insertOp('A', 2, 'b', { clientId: 'A', seq: 1 }));
    doc.delete(deleteOp('A', 1)); 
    expect(doc.getText()).toBe('b');
  });

  test('deleted chars remain as tombstones (getChars includes them)', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'x', null));
    doc.delete(deleteOp('A', 1));
    expect(doc.getChars()).toHaveLength(1);
    expect(doc.getChars()[0].deleted).toBe(true);
    expect(doc.getText()).toBe('');
  });

  test('can still insert after a deleted char (tombstone is valid anchor)', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'a', null));
    doc.insert(insertOp('A', 2, 'b', { clientId: 'A', seq: 1 }));
    doc.delete(deleteOp('A', 1));
    doc.insert(insertOp('A', 3, 'x', { clientId: 'A', seq: 1 }));
    expect(doc.getText()).toBe('xb');
  });
});

describe('Idempotency', () => {
  test('applying the same insert op twice has no effect', () => {
    const doc = new CRDTDocument();
    const op = insertOp('A', 1, 'a', null);
    doc.insert(op);
    doc.insert(op); // duplicate
    expect(doc.getText()).toBe('a');
    expect(doc.getChars()).toHaveLength(1);
  });

  test('applying the same delete op twice has no effect', () => {
    const doc = new CRDTDocument();
    doc.insert(insertOp('A', 1, 'a', null));
    const del = deleteOp('A', 1);
    doc.delete(del);
    doc.delete(del); // duplicate
    expect(doc.getText()).toBe('');
    expect(doc.getOps()).toHaveLength(2);
  });
});

describe('Convergence', () => {
  test('concurrent inserts at the same position converge', () => {
    const opA = insertOp('client-a', 1, 'a', null);
    const opB = insertOp('client-b', 1, 'b', null);

    const replica1 = new CRDTDocument();
    replica1.insert(opA);
    replica1.insert(opB);

    const replica2 = new CRDTDocument();
    replica2.insert(opB);
    replica2.insert(opA);

    expect(replica1.getText()).toBe(replica2.getText());
  });

  test('concurrent inserts at different positions converge', () => {
    const opA = insertOp('A', 1, 'a', null);
    const opC = insertOp('A', 2, 'c', { clientId: 'A', seq: 1 });

    const opB1 = insertOp('client-1', 1, 'b', { clientId: 'A', seq: 1 });
    const opX2 = insertOp('client-2', 1, 'x', { clientId: 'A', seq: 2 });

    const r1 = new CRDTDocument();
    r1.insert(opA); r1.insert(opC);
    r1.insert(opB1); r1.insert(opX2);

    const r2 = new CRDTDocument();
    r2.insert(opA); r2.insert(opC);
    r2.insert(opX2); r2.insert(opB1); 

    expect(r1.getText()).toBe('abcx');
    expect(r2.getText()).toBe('abcx');
  });

  test('concurrent delete and insert on the same char converge', () => {
    const opInsert = insertOp('A', 1, 'a', null);
    const opDelete = deleteOp('A', 1);
    const opAfterDeleted = insertOp('B', 1, 'b', { clientId: 'A', seq: 1 });

    const r1 = new CRDTDocument();
    r1.insert(opInsert);
    r1.delete(opDelete);
    r1.insert(opAfterDeleted);

    const r2 = new CRDTDocument();
    r2.insert(opInsert);
    r2.insert(opAfterDeleted);
    r2.delete(opDelete);

    expect(r1.getText()).toBe(r2.getText());
  });

  test('concurrent ops from two clients converge regardless of arrival order', () => {
    const base = [
      insertOp('X', 1, 'h', null),
      insertOp('X', 2, 'e', { clientId: 'X', seq: 1 }),
      insertOp('X', 3, 'l', { clientId: 'X', seq: 2 }),
      insertOp('X', 4, 'l', { clientId: 'X', seq: 3 }),
      insertOp('X', 5, 'o', { clientId: 'X', seq: 4 }),
    ];

    const opA = insertOp('A', 1, '!', { clientId: 'X', seq: 5 });
    const opB = deleteOp('X', 2);

    const r1 = new CRDTDocument();
    base.forEach(op => r1.apply(op));
    r1.apply(opA);
    r1.apply(opB);

    const r2 = new CRDTDocument();
    base.forEach(op => r2.apply(op));
    r2.apply(opB);
    r2.apply(opA);

    expect(r1.getText()).toBe(r2.getText());
    expect(r1.getText()).toBe('hllo!');
  });
});


describe('Op log replay', () => {
  test('replaying op log on a fresh document reconstructs the same text', () => {
    const original = new CRDTDocument();
    original.insert(insertOp('A', 1, 'h', null));
    original.insert(insertOp('A', 2, 'i', { clientId: 'A', seq: 1 }));
    original.insert(insertOp('A', 3, '!', { clientId: 'A', seq: 2 }));
    original.delete(deleteOp('A', 3));

    const replica = new CRDTDocument();
    for (const op of original.getOps()) {
      replica.apply(op);
    }

    expect(replica.getText()).toBe(original.getText());
    expect(replica.getText()).toBe('hi');
  });
});
