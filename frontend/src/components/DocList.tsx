interface Doc {
  id: string;
  createdAt: string;
}

interface Props {
  docs: Doc[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function DocList({ docs, activeId, onSelect, onCreate }: Props) {
  return (
    <div className="flex flex-col h-full border-r-2 border-gray-900 w-52 shrink-0 bg-[#f5f1e8]">
      <div className="flex items-center justify-between px-3 py-3 border-b-2 border-gray-900">
        <span className="text-xs font-bold uppercase tracking-wide">Documents</span>
        <button
          onClick={onCreate}
          className="text-xs font-bold px-2 py-1 bg-[#f4d03f] hover:bg-[#e5c536] transition-colors border-0"
        >
          + New
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {docs.length === 0 && (
          <li className="px-3 py-3 text-xs text-gray-500">No documents yet</li>
        )}
        {docs.map((doc, index) => (
          <li key={doc.id} className="border-b border-gray-300">
            <button
              onClick={() => onSelect(doc.id)}
              className={`w-full text-left px-3 py-3 text-sm transition-colors ${
                doc.id === activeId
                  ? 'bg-white font-bold'
                  : 'hover:bg-white/50'
              }`}
            >
              Untitled document {docs.length > 1 ? index + 1 : ''}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
