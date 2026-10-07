import { ArrowUpRight } from "lucide-react";

function PeonyFlower() {
  return <svg className="cta-bloom" viewBox="0 0 32 32" aria-hidden="true">
    <g fill="#E5648D">{[0,60,120,180,240,300].map((r)=><ellipse key={r} cx="16" cy="8.5" rx="5.6" ry="8" transform={`rotate(${r} 16 16)`}/>)}</g>
    <g fill="#F28FAF">{[30,90,150,210,270,330].map((r)=><ellipse key={r} cx="16" cy="11.5" rx="4.6" ry="6" transform={`rotate(${r} 16 16)`}/>)}</g>
    <circle cx="16" cy="16" r="5" fill="#FAC3D6"/><circle cx="16" cy="16" r="1.9" fill="#F2C240"/>
  </svg>;
}

export default function PeonyFooter() {
  return <section className="cta">
    <PeonyFlower />
    <div className="wrap cta-inner">
      <h2>Less inbox.<br />More clarity.</h2>
      <p className="copy">Peony is being built as a softer, calmer way to move through email, organized around what needs you, not what arrived most recently.</p>
      <div className="hero-cta">
        <a className="btn btn-ink" href="#act">Open Peony</a>
        <a className="btn btn-ghost" href="#top">Back to the top <ArrowUpRight size={15} /></a>
      </div>
    </div>
  </section>;
}
