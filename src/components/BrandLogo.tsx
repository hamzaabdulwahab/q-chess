type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-7 w-7 text-[1.5rem]",
  md: "h-9 w-9 text-[1.875rem]",
  lg: "h-20 w-20 text-[4.5rem]",
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
