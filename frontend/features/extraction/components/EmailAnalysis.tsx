import { describeMissingExtraction, type AnalysisState } from "../analysis";
import type { EmailExtraction } from "../extractionTypes";
import type { Email } from "../types";
import AnalysisStrip from "./AnalysisStrip";
import CreateSiLink from "./CreateSiLink";
import ExtractionPanel from "./ExtractionPanel";

interface EmailAnalysisProps {
  email: Email;
  state: AnalysisState;
  extraction: EmailExtraction | null;
}

/** The strip under each email row. Picks what to show from the email's pipeline state. */
export default function EmailAnalysis({ email, state, extraction }: EmailAnalysisProps) {
  switch (state) {
    case "unanalysed":
      return (
        <AnalysisStrip
          emailId={email.email_id}
          message="Not analysed yet."
          buttonLabel="Analyse"
        />
      );

    case "extraction-missing":
      return (
        <AnalysisStrip
          emailId={email.email_id}
          message={describeMissingExtraction(email)}
          buttonLabel={email.review_reason ? "Retry extraction" : "Extract fields"}
        />
      );

    case "extracted":
      return extraction ? <ExtractionPanel extraction={extraction} /> : null;

    default:
      return email.category === "SI_REQUEST" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-2.5">
          <p className="text-sm text-gray-600">Shipping instruction request.</p>
          <CreateSiLink emailId={email.email_id} />
        </div>
      ) : null;
  }
}
