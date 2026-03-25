interface Props {
  clients: string[];
  myClientId: string;
}

export function PresenceList({ clients, myClientId }: Props) {
  if (clients.length === 0) return null;

  return (
    <div className="p-3">
      <p className="text-xs font-bold uppercase tracking-wide mb-3">
        {clients.length} online
      </p>
      <ul className="space-y-2">
        {clients.map((id, index) => (
          <li key={id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm">
              {id === myClientId ? 'You' : `User ${index + 1}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
