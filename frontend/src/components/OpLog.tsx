import { type Op } from '../crdt/types';

interface LogEntry {
  op: Op;
  clientId: string;
  fromServer: boolean;
}

interface Props {
  entries: LogEntry[];
}

export function OpLog({ entries }: Props) {
  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Op Log ({entries.length})
      </p>
      <ul className="flex-1 overflow-y-auto space-y-0.5 font-mono">
        {entries.length === 0 && (
          <li className="text-xs text-gray-400">No ops yet</li>
        )}
        {[...entries].reverse().map((entry, i) => (
          <li key={i} className="text-xs leading-5">
            <span className={`${entry.fromServer ? 'text-blue-600' : 'text-gray-700'}`}>
              {entry.op.type === 'insert'
                ? `insert '${entry.op.char.value === '\n' ? '⏎' : entry.op.char.value}' seq=${entry.op.char.id.seq}`
                : `delete seq=${entry.op.id.seq}`}
            </span>
            <span className="text-gray-400 ml-1">
              {entry.fromServer ? `← ${entry.clientId.slice(0, 6)}` : '← you'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { LogEntry };
