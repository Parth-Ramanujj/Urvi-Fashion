import { useId } from "react";
import type { ArtKind } from "@/lib/types";

// Built-in vector product art so the catalog looks complete with zero image hosting; colour swatches recolour it live.
// Real photos uploaded from the admin panel replace these per colour.

function mix(hex: string, to: string, t: number) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

const LONG = "M155 65 L200 92 L245 65 L300 82 L338 120 L368 330 L330 338 L300 185 L296 440 L104 440 L100 185 L70 338 L32 330 L62 120 L100 82 Z";
const BODY: Record<ArtKind, string> = {
  tee: "M150 70 Q200 108 250 70 L302 86 L356 150 L318 186 L292 162 L292 440 L108 440 L108 162 L82 186 L44 150 L98 86 Z",
  shirt: LONG,
  hoodie: LONG,
  jacket: LONG,
  dress: "M165 58 L200 84 L235 58 L256 70 L252 150 L242 205 L322 440 L78 440 L158 205 L148 150 L144 70 Z",
  pants: "M118 58 L282 58 L298 452 L214 452 L200 172 L186 452 L102 452 Z",
  skirt: "M138 118 L262 118 L324 404 L76 404 Z",
  shorts: "M112 128 L288 128 L310 332 L214 342 L200 222 L186 342 L90 332 Z",
  cap: "M108 300 Q108 148 200 148 Q292 148 292 300 Z",
  bag: "M98 192 L302 192 L322 432 L78 432 Z",
  scarf: "M150 52 L250 52 L250 372 L234 432 L166 432 L150 372 Z",
  sneaker: "M58 332 Q66 252 138 242 L196 232 Q240 200 282 232 L342 300 Q362 320 352 346 L70 360 Q54 350 58 332 Z",
};

function Details({ kind, line, light }: { kind: ArtKind; line: string; light: string }) {
  const s = { stroke: line, strokeWidth: 3, fill: "none", strokeLinecap: "round" as const };
  switch (kind) {
    case "tee": return <path d="M150 70 Q200 108 250 70" {...s} strokeWidth={7} />;
    case "shirt": return (<g><path d="M155 65 L200 92 L176 124 Z M245 65 L200 92 L224 124 Z" fill={light} stroke={line} strokeWidth={2} /><path d="M200 92 V440" {...s} />{[150, 200, 250, 300, 350, 400].map((y) => <circle key={y} cx={208} cy={y} r={4} fill={light} />)}<path d="M120 200 h40 v34 h-40 z" {...s} strokeWidth={2} /></g>);
    case "hoodie": return (<g><path d="M136 82 Q200 -6 264 82 Q200 58 136 82 Z" fill={line} opacity={0.55} /><path d="M184 96 L180 176 M216 96 L220 176" {...s} strokeWidth={2.5} /><circle cx={180} cy={180} r={4} fill={light} /><circle cx={220} cy={180} r={4} fill={light} /><path d="M138 328 H262 L282 410 H118 Z" {...s} strokeWidth={2.5} /><path d="M104 420 H296" {...s} strokeWidth={5} /></g>);
    case "jacket": return (<g><path d="M155 65 L196 206 L170 100 Z M245 65 L204 206 L230 100 Z" fill={light} stroke={line} strokeWidth={2} /><path d="M200 92 V440" stroke={line} strokeWidth={4} strokeDasharray="3 4" /><path d="M126 300 h44 v40 h-44 z M230 300 h44 v40 h-44 z" {...s} strokeWidth={2} /><path d="M104 420 H296" {...s} strokeWidth={6} /></g>);
    case "dress": return (<g><path d="M150 202 Q200 216 250 202" {...s} strokeWidth={9} /><path d="M165 58 Q200 120 235 58" {...s} /><path d="M140 300 Q150 380 130 440 M200 230 V440 M260 300 Q250 380 270 440" {...s} strokeWidth={1.5} opacity={0.5} /></g>);
    case "pants": return (<g><path d="M118 58 H282 V82 H118 Z" fill={line} opacity={0.35} /><path d="M200 82 V160" {...s} /><path d="M140 82 Q150 120 128 130 M260 82 Q250 120 272 130" {...s} strokeWidth={2} />{[140, 170, 200, 230, 260].map((x) => <rect key={x} x={x - 3} y={58} width={6} height={24} fill={light} opacity={0.6} />)}</g>);
    case "skirt": return (<g><path d="M138 118 H262 V140 H138 Z" fill={line} opacity={0.35} />{[110, 150, 200, 250, 290].map((x, i) => <path key={x} d={`M${160 + i * 20} 140 L${x} 404`} {...s} strokeWidth={1.5} opacity={0.6} />)}</g>);
    case "shorts": return (<g><path d="M112 128 H288 V152 H112 Z" fill={line} opacity={0.35} /><path d="M200 152 V215" {...s} /><path d="M118 230 h40 v44 h-40 z M242 230 h40 v44 h-40 z" {...s} strokeWidth={2} /></g>);
    case "cap": return (<g><path d="M98 298 Q200 334 342 290 Q352 322 300 342 Q200 352 98 322 Z" fill={line} opacity={0.75} /><circle cx={200} cy={150} r={8} fill={line} /><path d="M200 152 V298 M150 168 Q140 230 150 300 M250 168 Q260 230 250 300" {...s} strokeWidth={1.5} opacity={0.6} /></g>);
    case "bag": return (<g><path d="M150 192 Q150 82 200 82 Q250 82 250 192" stroke={line} strokeWidth={14} fill="none" /><path d="M98 232 H302" {...s} strokeWidth={2} strokeDasharray="6 6" /><rect x={176} y={250} width={48} height={18} rx={4} fill={light} /></g>);
    case "scarf": return (<g>{[90, 150, 210, 270, 330].map((y) => <path key={y} d={`M150 ${y} H250`} {...s} strokeWidth={10} opacity={0.35} />)}{[172, 186, 200, 214, 228].map((x) => <path key={x} d={`M${x} 432 V470`} {...s} strokeWidth={3} />)}</g>);
    case "sneaker": return (<g><path d="M52 346 L356 340 L352 368 L60 378 Z" fill="#f4f4f2" stroke={line} strokeWidth={2} /><path d="M176 248 L206 280 M196 240 L226 272 M216 234 L246 266" {...s} stroke={light} strokeWidth={5} /><path d="M120 300 Q200 280 300 320" {...s} strokeWidth={2} opacity={0.6} /></g>);
  }
}

export default function ProductArt({ kind, hex, view = "front", className }: { kind: ArtKind; hex: string; view?: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const isLight = lum(hex) > 0.8;
  const line = mix(hex, "#000000", isLight ? 0.28 : 0.32);
  const light = mix(hex, "#ffffff", 0.45);
  const bgA = mix(hex, "#f4f1ec", isLight ? 0.4 : 0.86);
  const bgB = mix(hex, "#e7e3dc", isLight ? 0.55 : 0.78);
  const zoom = view === "detail" ? "translate(200 250) scale(2.3) translate(-200 -210)" : view === "back" ? "translate(400 0) scale(-1 1)" : undefined;
  return (
    <svg viewBox="0 0 400 500" className={className} role="img" aria-label={`${kind} in ${hex}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="38%" r="75%"><stop offset="0" stopColor={bgA} /><stop offset="1" stopColor={bgB} /></radialGradient>
        <linearGradient id={`sh${uid}`} x1="0" x2="1"><stop offset="0" stopColor={mix(hex, "#ffffff", 0.14)} /><stop offset="0.55" stopColor={hex} /><stop offset="1" stopColor={mix(hex, "#000000", 0.2)} /></linearGradient>
        <pattern id={`tx${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 V6" stroke={line} strokeWidth="1" opacity="0.12" /></pattern>
        <filter id={`ds${uid}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="14" floodOpacity="0.22" /></filter>
      </defs>
      <rect width="400" height="500" fill={`url(#bg${uid})`} />
      <g transform={zoom}>
        <path d={BODY[kind]} fill={`url(#sh${uid})`} stroke={line} strokeWidth={2} strokeLinejoin="round" filter={`url(#ds${uid})`} />
        <path d={BODY[kind]} fill={`url(#tx${uid})`} />
        {view === "back" ? (kind === "hoodie" ? <path d="M136 82 Q200 -6 264 82 Q200 58 136 82 Z" fill={line} opacity={0.55} /> : <rect x={188} y={kind === "pants" || kind === "shorts" ? 92 : 84} width={24} height={12} rx={2} fill={light} opacity={0.9} />) : <Details kind={kind} line={line} light={light} />}
      </g>
    </svg>
  );
}
