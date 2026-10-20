export default function StoneBrand({ light = false, name = 'ARABIC STONE', squareOnly = false }: { light?: boolean; name?: string; squareOnly?: boolean }) {
  if (squareOnly) return <div className="stone-brand-square-frame"><span className="stone-brand-square" role="img" aria-label="Emblème Arabic Stone en marbre" /></div>;
  if (name === 'ARABIC STONE') return <div className={`stone-brand stone-brand-official ${light ? 'stone-brand-light' : ''}`}><span className="stone-brand-logo" role="img" aria-label="Arabic Stone — Marbre & pierre naturelle" /></div>;
  return <div className={`stone-brand ${light ? 'stone-brand-light' : ''}`}>
    <span className="stone-brand-mark" aria-hidden="true"><i /></span>
    <div><span className="stone-brand-name">{name === 'ARABIC STONE' ? <>ARABIC<br />STONE</> : name}</span><span className="stone-brand-tagline">MARBRE & PIERRE NATURELLE</span></div>
  </div>;
}
