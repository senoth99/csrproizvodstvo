import Image from "next/image";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: number;
  alt?: string;
  priority?: boolean;
};

/** Логотип из `public/` — единый компонент вместо сырого `<img>`. */
export function BrandLogo({ className, size = 96, alt = "Logo", priority = false }: Props) {
  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}
