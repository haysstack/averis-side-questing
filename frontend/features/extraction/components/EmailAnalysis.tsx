import { describeMissingExtraction, type AnalysisState } from "../analysis";
import type { EmailExtraction } from "../extractionTypes";
import type { Email } from "../types";
import AnalysisStrip from "./AnalysisStrip";
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
      return null;
  }
}
