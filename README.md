# Voyara

Voyara is built around one idea: **make the next step obvious.**

Instead of adding another complicated system for workers to learn, Voyara turns the inbox into a simple workspace where emails are sorted, relevant documents are read, and important differences are brought forward.

- **See what needs attention** — emails are automatically sorted into clear categories.
- **Check documents at a glance** — SI and BL information is extracted and placed side by side instead of requiring manual searching.
- **Focus on exceptions** — matching information can be left alone while mismatches, missing fields and unclear documents are highlighted.
- **Keep humans in control** — uncertain cases are sent for review rather than silently making a guess.
- **Complete the workflow in one place** — SI requests, document checks and reply drafts can be handled from the same inbox.

**VOYARA**
- A complex Voyage, a simple Arrangement.
- VOY = Voyage.
- ARA = Arrangement.

Voyara acts as an email triage and document checking for shipping operations teams. Voyara sorts an inbox, reads Shipping Instruction (SI) and draft Bill of Lading (BL) attachments, compares them field by field, and sends unclear cases to a person.

## 1. Problem

Shipping operations teams get document check requests, new SI requests, invoice questions, updates and spam in one inbox.

**Manual workflow**
- Read every email and decide what it needs.
- Open the SI and the draft BL, then compare seven fields by eye: shipper, consignee, notify party, port of loading, port of discharge, container count and gross weight (kg).
- The same field is labelled differently across documents ("Port of Loading" vs "Load Port").

**Why it matters**
- A document request that gets overlooked never reaches the check.
- A missed mismatch turns into corrections, delays and extra work after the BL is finalised.

**What Voyara changes**
- Emails are classified automatically into five categories.
- SI and BL fields are extracted and shown side by side, with mismatches flagged.
- Missing, unreadable or wrong documents go to a review queue with the evidence, instead of being guessed.
- SI drafts and reply drafts can be prepared from the same inbox.

## 2. Tech Stack

### Frontend

- **Framework:** Next.js 16.3.5 (App Router), React 19.2.8
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Other packages:** `docx-preview` (shows Word attachments in the page)

**Pages**

| Route | What it does |
|-------|--------------|
| `/` | Review queue: active and resolved tabs, search, filters by category and reason, resolve dialog with reason-specific actions and field corrections |
| `/extraction` | Sidebar views of the inbox: All, Invoice Queries, SI and BL Comparisons, SI Creation Requests, Unreviewed, General, Spam, plus a "Frequent senders" section |
| `/extraction/[view]`, `/extraction/senders/[domain]` | Filtered views |
| `/si-creation?email_id=` | SI editor with live PDF preview, template management and follow-up or confirmation email drafts |

**Extraction page features**
- Search, priority and "has attachments" filters, sorting, jump-to-page. All state is kept in the URL (`page`, `sort`, `q`, `field`, `priority`, `attachments`, `email`).
- Side panel with the full email, AI summary, attachments and a "Draft reply" button.
- Attachment viewer: PDF and text in an iframe, Word through `docx-preview`, other types download only.
- SI and BL extracted fields side by side with a confidence chip per document, and the reason when nothing was extracted.
- "Analyse" buttons per email and per page. New pages can be analysed automatically (toggle saved in `localStorage`), and rows update while a batch runs.
- draft replies to commonly recieved emails based on specific templates, and utilizing AI to draft replies for unique requests.

**Talking to the backend**
- Review queue, inbox and SI pages call FastAPI directly from the browser (`NEXT_PUBLIC_API_URL`, default `http://localhost:8000`).
- Extraction pages fetch on the server (`API_BASE_URL`) and use Next.js route handlers under `app/api/` for actions and attachments, so the browser only talks to the Next app.

### Backend

- **Framework:** FastAPI 0.141.1 with Uvicorn
- **Language:** Python
- **Validation:** Pydantic 2
- **Routers:**

| File | Responsibility |
|------|----------------|
| `routers/classify.py` | Import, classify, list emails, stats, senders, reply drafts |
| `routers/extract.py` | Extract SI and BL fields from attachments |
| `routers/compare.py` | Compare SI and BL extractions (`compare_email`) |
| `routers/si_creation.py` | SI draft and PDF export |
| `routers/review/` | Review queue, resolve, submission check |

- **Libraries:** `pymupdf` (PDF text and page images), `python-docx`, `openpyxl`, `httpx` (calls to the Docker inbox), `requests`, `supabase`, `google-genai`, `python-dotenv`
- **Helpers:** `db.py` (Supabase client), `data_source.py` (`get_all_emails`)

### Database / Storage

- **Database:** Supabase (Postgres), accessed with the service key.

| Table | Contents |
|-------|----------|
| `emails` | `email_id`, `from_addr`, `subject`, `body`, `category`, `priority`, `ai_summary`, `status`, `review_reason` |
| `extractions` | One row per document (`doc_type` SI or BL): the seven fields plus `confidence` |
| `comparisons` | `has_defect`, `defect_fields` per email |
| `reviews` | `reason`, `confidence`, `resolved`, `corrected_by`, `corrected_at` |

- **Statuses seen in code:** `PENDING`, `CLASSIFIED`, `NEEDS_REVIEW`, `RESOLVED`
- **Attachments** are not stored in Supabase. They are served by the Docker inbox server.
- **Browser storage:** custom SI templates (`averis_si_custom_templates`) and the auto-analyse toggle.

### AI / APIs

- **Gemini** through `google-genai`. The model comes from `GEMINI_MODEL` (default `gemini-2.5-flash`).

| Used for | Input | Output |
|----------|-------|--------|
| Classification | Subject and first 2,500 characters of the body | JSON: `category`, `priority`, `summary` |
| Scanned or hard PDFs | First 3 pages rendered as images | JSON with the seven fields |
| Unknown field labels | The label text | A canonical field name or `none` |
| Reply drafts (when no template fits) | Category, subject, body | Reply text |

**Backend endpoints**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/classification/health` | Health check |
| POST | `/seed-emails` | Import all emails from the Docker inbox into `emails` |
| POST | `/classify/{email_id}` | Classify one email. Returns the saved result unless `force=true` |
| POST | `/classify-pending` | Classify up to `limit` pending emails |
| GET | `/emails` | List emails. Params used by the frontend: `category`, `priority`, `status`, `sort`, `sender_domain`, `needs_review`, `search`, `search_field`, `attachments_only`, `limit`, `offset` |
| GET | `/emails/{email_id}` | One email |
| GET | `/classification/stats` | Counts by status, category and priority |
| GET | `/senders` | Sender domains by email count (`min_count`, `limit`) |
| POST | `/reply/{email_id}` | Draft a reply: templates first, Gemini fallback (`force_ai`) |
| GET | `/extraction/health` | Health check |
| POST | `/extract/{email_id}` | Extract SI and BL fields (`force`, `dry_run`) |
| POST | `/extract-batch` | Extract for up to `limit` classified BL_COMPARISON emails |
| GET | `/extractions` | Extraction rows, optionally filtered by `email_ids` |
| GET | `/review-queue` | Review items with SI-vs-BL evidence (`resolved`) |
| POST | `/review/{email_id}/resolve` | Save a resolution: `outcome`, `notes`, `corrections`, `corrected_by` |
| POST | `/submit-check` | Build the submission for all emails, validate it, send it to the Docker server |
| POST | `/si/draft/{email_id}` | Build an SI draft from a request email |
| POST | `/si/export-pdf` | Render an SI draft to PDF |

**Next.js route handlers**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/analyse/{emailId}` | Classify, then extract for SI/BL emails (`?step=classify` or `extract`) |
| GET | `/api/attachments/{...path}` | Stream an attachment from the Docker inbox (`?download=1`) |
| POST | `/api/reply/{emailId}` | Proxy to `POST /reply/{email_id}` |

### Infrastructure / Tools

- **Docker inbox server** (`http://localhost:8080`): the provided dataset server. Used endpoints: `GET /emails`, `GET /emails/{email_id}`, `GET /{attachment_path}` and `POST /submit` (scoring).
- **Deployment:** Vercel
- **Backend `.env`** (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `DOCKER_INBOX_URL`
- **Frontend `.env.local`:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DOCKER_INBOX_URL`, `API_BASE_URL`, `DOCKER_INBOX_URL`
- **Dev tools:** ESLint 9, Python venv

**Run locally**

```bash
# 1. Docker inbox server (provided dataset)
docker compose up --build

# 2. Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 3. Frontend
cd frontend
npm install
npm run dev
```

### Repository layout

```
backend/
├── main.py, db.py, data_source.py, requirements.txt
├── routers/
│   ├── classify.py, extract.py, compare.py, si_creation.py
│   └── review/            review_queue.py, review_resolve.py, submit.py
├── services/
└── tests/
frontend/
├── app/
│   ├── page.tsx           review queue
│   ├── si-creation/
│   ├── extraction/        layout, [view], senders/[domain]
│   └── api/               analyse, attachments, reply
├── features/extraction/   api, config, components
└── lib/                   api-client.ts, routes.ts
```

## 3. Impact

What the project covers:
- A 520-email inbox (the submission builder in `submit.py` expects 520 email IDs).
- 5 email categories and 7 compared fields.
- Attachments in `.txt`, `.pdf`, `.docx` and `.xlsx`, plus scanned PDFs through the vision fallback.
- 4 review reasons: `wrong_doc_type`, `missing_attachment`, `unreadable`, `missing_value`.
- Includes automated classification, extraction, comparison, review and submission workflows.

Practical effect:
- Staff no longer open each email to find document requests. Requests are sorted into views with counts.
- The seven-field comparison becomes a table with SI and BL values next to each other.
- Cases that cannot be checked are queued with a reason and evidence.

### User experience

The main impact of Voyara is not adding more automation for the sake of automation. It is making the existing workflow easier to understand and complete.

Workers can quickly see **what needs attention, why it needs attention, and what they can do next** without having to navigate between separate tools or manually search through documents.

## 4. Implementation Details

```
Docker inbox (JSON emails + attachments)
  → /seed-emails      → emails (PENDING)
  → /classify         → category, priority, summary (CLASSIFIED)
  → /extract          → extractions (SI row + BL row)
  → compare_email     → comparisons (has_defect, defect_fields)
  → review queue      → human resolves or corrects
  → /submit-check     → Docker /submit
```

### Ingestion and classification
- `/seed-emails` copies `email_id`, sender, subject and body from the Docker server into Supabase.
- `/classify/{email_id}` fetches the email, sends the subject and first 2,500 characters of the body to Gemini with a JSON schema, and saves the result with status `CLASSIFIED`.
- Priority comes only from urgency words and dates in the email.
- Already classified emails return the saved result unless `force=true`.

### Extraction
- Only `BL_COMPARISON` emails that are `CLASSIFIED` are extracted (unless `force=true`).
- The SI and BL are found by `_si` and `_bl` in the attachment file names.
- Parsers by type:
  - `.txt`, `.docx` paragraphs: `Label: Value` lines.
  - `.docx` tables and `.xlsx`: label and value cells.
  - `.pdf`: text lines, then a table heuristic, then the Gemini vision fallback for scans or PDFs with fewer than 2 recognised fields.
- Labels are cleaned (brackets and non-ASCII removed, lowercased) and matched to the seven fields with a synonym dictionary. Gemini is only asked when the dictionary has no match, and answers are cached in memory.
- Container count and weight are parsed to numbers and range-checked (1–999 containers, 1–5,000,000 kg). Out-of-range values are discarded with a warning.
- Conflicting values for one field keep the first (numbers) or the longest (text) and add a warning.
- `confidence` is the share of the seven fields found, scaled by parse method, minus small penalties for AI label matching and warnings.
- Rows are saved by deleting the email's old rows and inserting the SI and BL rows. `dry_run=true` returns results without saving.

### SI / BL Comparison

After the SI and BL documents have been extracted, Voyara compares the seven canonical fields:

- Shipper
- Consignee
- Notify party
- Port of loading
- Port of discharge
- Container count
- Gross weight (kg)

Text values are normalized before comparison by lowercasing, removing extra whitespace and punctuation. Numeric values are normalized so values such as formatted numbers can be compared consistently.

Each field is recorded with its SI value, BL value and comparison result. The comparison distinguishes between:

- **Match** — both values are present and equivalent.
- **Mismatch** — both values are present but different.
- **Missing value** — one or both documents do not contain a usable value.

Voyara does not automatically assume a document is correct when the extraction is unreliable. If either document has low extraction confidence, the email is sent to the review queue as **NEEDS_REVIEW** with an `unreadable` reason. Missing SI or BL extractions are handled as `missing_attachment`, while incomplete field data is handled as `missing_value`.

For complete and sufficiently reliable extractions, the comparison is stored in Supabase. The email is then marked as:

- `OK` when all seven fields match.
- `MISMATCH` when one or more fields differ.
- `NEEDS_REVIEW` when the comparison cannot be completed reliably.

### Review and submission
- `/review-queue` merges `reviews`, emails with status `NEEDS_REVIEW`, `extractions` and `comparisons`. For each item it builds the seven-field evidence and marks fields as mismatched or missing. Placeholder values such as `???`, `TBA`, `N/A` count as missing.
- `/review/{email_id}/resolve` applies corrections to the BL extraction row, re-runs `compare_email`, marks the review resolved and sets the email status to `RESOLVED`.
- The review page picks its actions from the reason (for example request a rescan, confirm wrong document, enter verified values) and converts field labels back to column names before saving.
- `/submit-check` builds one entry per email ID: an unresolved review means `NEEDS_REVIEW`; `BL_COMPARISON` uses the `comparisons` row (`MISMATCH` or `OK`); a `BL_COMPARISON` email with no comparison row is sent as `NEEDS_REVIEW` with `missing_value`; other categories are `OK`. The payload is validated before it is sent.

### Extraction page (frontend)
- Pages are server components. Search, filters, sort, page and the open email are read from the URL.
- Analysing an email calls `/api/analyse/{id}`: classify first, then extract if it is an SI/BL comparison. Batches run two emails at a time and refresh the list at most every 1.5 seconds, so labels appear as each email finishes.
- Reply drafts use a template chosen by category and keywords. SI/BL replies use the `comparisons` result when it exists. Gemini is used only when no template fits or when "Rewrite with AI" is clicked. Spam gets no reply. Drafts are copied or opened in a mail app, not sent.
- Frequent senders are grouped by the domain in `from_addr`.

### Error handling
- Extraction runs per document. A failed download or parse saves an empty row with confidence 0 and the other document is still processed.
- Backend errors return FastAPI `detail` text, which the frontend shows.
- If the backend is down, the sidebar still renders without counts. If extraction data cannot load, the list shows with a notice.
- Gemini failures return HTTP 502. An unreachable Docker inbox returns HTTP 503.

## 5. Challenges Faced

| Challenge | How it was handled |
|-----------|--------------------|
| Same field, different labels | Synonym dictionary per field, plus a cached Gemini lookup for unknown labels |
| Four file types and scanned PDFs | One parser per type, a table heuristic for PDFs, and a vision fallback on the first 3 pages |
| Unreliable extracted values | Range checks, conflict warnings and a confidence score; `dry_run` to inspect results before saving |
| Blank or placeholder values in documents | A blank-token list marks them as missing and routes them to the `missing_value` review |
| Missing or wrong attachments | Review reasons `missing_attachment` and `wrong_doc_type`, with the evidence shown to the reviewer |
| Word files cannot be shown in an iframe | Rendered in the page with `docx-preview` |
| Gemini latency and rate limits during batches | Classification is cached, batches run two at a time, and only unanalysed emails are sent |

## 6. Future Roadmap

**User experience**
- Send replies from the app instead of copying or using a mail link.
- Preview `.xlsx` attachments.
- Link the extraction views and the review queue to each other.

**Multi-Language Document Processing**
- Support shipping documents in different languages
- automatically recognize and extract relevant fields without requiring a fixed language format

**Predictive Risk Detection**
- Analyze historical shipment data and document patterns 
- identify potentially risky or unusual shipments before discrepancies occur

**Role-Based Access Control**
- Introduce different user roles and permissions
- administrators, reviewers, and operators can access only the features and information relevant to their responsibilities