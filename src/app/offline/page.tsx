/** /offline — PWA offline fallback shell. */
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-28 text-center">
      <WifiOff className="mb-4 h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        AniKuoshi&apos;s shell is cached, but live catalog data needs a connection. Reconnect and
        the app picks up right where you left off.
      </p>
      <Button className="mt-6 border-0 bg-primary text-primary-foreground" asChild>
        <Link href="/">Back to safety</Link>
      </Button>
    </div>
  );
}
