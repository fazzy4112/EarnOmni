interface UserAvatarProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  className?: string;
}

export function UserAvatar({ avatarUrl, fullName, className = "h-10 w-10" }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={fullName ?? "Profile picture"}
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  const initials = fullName?.trim()
    ? fullName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  return (
    <div
      className={`${className} grid place-items-center rounded-full bg-[image:var(--gradient-hero)] font-semibold text-primary-foreground`}
    >
      {initials}
    </div>
  );
}
