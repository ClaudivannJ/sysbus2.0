interface LogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
  subtitle?: string;
}

export default function Logo({
  className = "flex items-center gap-2.5",
  imageClassName = "h-8 w-auto object-contain",
  showText = false,
  textClassName = "text-white font-bold text-sm",
  subtitle,
}: LogoProps) {
  return (
    <div className={className}>
      <img src="/sysbus-logo.png" alt="SYSBUS Logo" className={imageClassName} />
      {showText && (
        <div className="leading-tight">
          <p className={textClassName}>SYSBUS</p>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
