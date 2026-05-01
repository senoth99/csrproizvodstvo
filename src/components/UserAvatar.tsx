type UserAvatarProps = {
  name: string;
  photoUrl?: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const sizeClassMap = {
  sm: "h-4 w-4 text-[9px]",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-sm"
} as const;

export function UserAvatar({ name, photoUrl, color, size = "md", className = "" }: UserAvatarProps) {
  const sizeClass = sizeClassMap[size];
  const baseClass = `inline-flex items-center justify-center rounded-full border border-border object-cover ${sizeClass} ${className}`.trim();

  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={baseClass} />;
  }

  return (
    <span
      className={`${baseClass} font-semibold text-white`}
      style={{ backgroundColor: color || "#6b7280" }}
      aria-label={name}
    >
      {initialsFromName(name)}
    </span>
  );
}
