import { describeMissingExtraction, type AnalysisState } from "../analysis";
import type { EmailExtraction } from "../extractionTypes";
import type { ComparisonRow } from "../comparisonTypes";
import type { Email } from "../types";
import AnalysisStrip from "./AnalysisStrip";
import CreateSiLink from "./CreateSiLink";
import ExtractionPanel from "./ExtractionPanel";
import ComparisonPanel from "./ComparisonPanel";

interface EmailAnalysisProps {
  email: Email;
  state: AnalysisState;
  extraction: EmailExtraction | null;
  comparison: ComparisonRow | null;
}

export default function EmailAnalysis({ email, state, extraction, comparison }: EmailAnalysisProps) {
  switch (state) {
    case "unanalysed":
      return <AnalysisStrip emailId={email.email_id} message="Not analysed yet." buttonLabel="Analyse" />;

    case "extraction-missing":
      return (
        <AnalysisStrip
          emailId={email.email_id}
          message={describeMissingExtraction(email)}
          buttonLabel={email.review_reason ? "Retry extraction" : "Extract fields"}
        />
      );

    case "extracted":
      return extraction ? (
        <>
          <ExtractionPanel extraction={extraction} />
          <ComparisonPanel emailId={email.email_id} extraction={extraction} comparison={comparison} />
        </>
      ) : null;

    default:
      return email.category === "SI_REQUEST" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-2.5">
          <p className="text-sm text-gray-600">Shipping instruction request.</p>
          <CreateSiLink emailId={email.email_id} />
        </div>
      ) : null;
  }
}