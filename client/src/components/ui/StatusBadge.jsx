import React from "react";

const tones={neutral:"bg-slate-100 text-slate-700 ring-slate-200",info:"bg-blue-50 text-blue-700 ring-blue-200",success:"bg-emerald-50 text-emerald-700 ring-emerald-200",warning:"bg-amber-50 text-amber-800 ring-amber-200",danger:"bg-red-50 text-red-700 ring-red-200"};
const inferred=value=>{const v=String(value||"").toLowerCase();if(/reject|cancel|expire|error|inactive/.test(v))return"danger";if(/complete|confirm|active|approved|success/.test(v))return"success";if(/pending|waiting|attention|change/.test(v))return"warning";if(/accept|quote|submitted|progress/.test(v))return"info";return"neutral"};
export default function StatusBadge({children,tone,className=""}){const resolved=tone||inferred(children);return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[resolved]||tones.neutral} ${className}`}>{children}</span>}
