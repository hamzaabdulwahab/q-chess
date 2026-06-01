type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md";
};

const sizeClass = {
  sm: "h-7 w-7 text-[1.5rem]",
  md: "h-9 w-9 text-[1.875rem]",
};

export function BrandLogo({ className = "", size = "md" }: BrandLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 select-none place-items-center leading-none text-white ${sizeClass[size]} ${className}`}
    >
      ♞
    </span>
  );
}
