import { useState } from "react";
import { Users } from "lucide-react";

type Props = {
  name: string;
  thumbnailUrl: string | null;
  className: string;
};

export function ChannelAvatar({ name, thumbnailUrl, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (thumbnailUrl && !failed) {
    return (
      <img
        src={thumbnailUrl}
        alt={name}
        className={`${className} object-cover border border-border/80`}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${className} bg-secondary border border-border/80 flex items-center justify-center`}>
      <Users className="size-5 text-muted-foreground" />
    </div>
  );
}
