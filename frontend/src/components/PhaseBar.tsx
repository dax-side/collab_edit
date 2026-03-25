interface Props {
  phase: number;
  description: string;
}

export function PhaseBar({ phase, description }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
      <span className="text-sm font-semibold text-gray-800">CollabEdit</span>
      <span className="text-gray-300">|</span>
      <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
        Phase {phase}
      </span>
      <span className="text-xs text-gray-500">{description}</span>
    </div>
  );
}
