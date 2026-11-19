import React from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import type { AuditReport } from '../../types/graph';

export const AuditBanner: React.FC = () => {
  const { nodes, edges, metadata, auditReport, setAuditReport } = useGraphStore();

  const handleRunAudit = async () => {
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
          })),
          metadata
        })
      });
      const data: AuditReport = await res.json();
      setAuditReport(data);
    } catch (e) {
      console.error('Audit failed:', e);
    }
  };

  const score = auditReport ? auditReport.maturity_score : 100;
  const issues = auditReport ? auditReport.issues : [];

  return (
    <div className="border-t border-zinc-800 bg-[#0d0d10] p-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {score >= 80 ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          )}
          <span className="font-semibold text-zinc-200">Health Check:</span>
          <span
            className={`font-mono font-bold ${
              score >= 80 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {score}%
          </span>
        </div>

        <button
          onClick={handleRunAudit}
          className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700"
          title="Запустить проверку логики графа"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Проверить</span>
        </button>
      </div>

      {issues.length > 0 && (
        <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
          {issues.slice(0, 3).map((issue, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-1.5 rounded p-1.5 text-[11px] ${
                issue.severity === 'error'
                  ? 'bg-rose-500/10 text-rose-300'
                  : 'bg-amber-500/10 text-amber-300'
              }`}
            >
              {issue.severity === 'error' ? (
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
              )}
              <span className="line-clamp-2">{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
