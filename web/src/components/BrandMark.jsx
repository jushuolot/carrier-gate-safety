import mark from "../assets/merck-mark.png";

/** Corner brand mark (Merck magenta wordmark) */
export default function BrandMark({ className = "", alt = "MERCK" }) {
  return <img className={`brand-mark-img ${className}`} src={mark} alt={alt} draggable={false} />;
}
