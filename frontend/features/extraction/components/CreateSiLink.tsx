import Link from "next/link";
import { routes } from "@/lib/routes";

/** Opens the teammate's SI creation page for this email. */
export default function CreateSiLink({ emailId }: { emailId: string }) {
  return (
    <Link
      href={routes.siCreation(emailId)}
      className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
    >
      Create SI
    </Link>
  );
}
