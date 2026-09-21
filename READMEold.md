## FIRST TIME SETUP
Get the Docker data server running (each person, once):

bash
cd sdoc-hackathon-docker
docker compose up --build
# leave this terminal open — serves http://localhost:8080

Backend setup (new terminal):

bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill in real keys — you'll need to share the Gemini key and Supabase keys with the team (e.g. via a private message, never commit them)
uvicorn main:app --reload
# runs on http://localhost:8000 — visit /docs to see it live

Frontend setup (another new terminal):

bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
# runs on http://localhost:3000

## RUN GUIDE
# Terminal 1
cd sdoc-hackathon-docker
docker compose up --build     # can drop --build after the first time, just docker compose up

# Terminal 2
cd backend
venv\Scripts\activate         # Windows — or source venv/bin/activate on Mac
uvicorn main:app --reload

# Terminal 3
cd frontend
npm run dev

## TABLE LAYOUTS GUIDE

create table emails (
  email_id text primary key,
  from_addr text,
  subject text,
  body text,
  category text,
  priority text,
  ai_summary text,
  status text default 'PENDING',
  review_reason text
);

create table extractions (
  id bigint generated always as identity primary key,
  email_id text references emails(email_id),
  doc_type text,  -- 'SI' or 'BL'
  shipper text,
  consignee text,
  notify_party text,
  port_of_loading text,
  port_of_discharge text,
  container_count int,
  gross_weight_kg numeric,
  confidence numeric
);

create table comparisons (
  email_id text primary key references emails(email_id),
  defect_fields text[],
  has_defect boolean default false
);

create table reviews (
  id bigint generated always as identity primary key,
  email_id text references emails(email_id),
  reason text,
  confidence numeric,
  resolved boolean default false,
  corrected_by text,
  corrected_at timestamp
);

## DATABASE TABLES
emails         (email_id, from_addr, subject, body, category, priority, ai_summary, status, review_reason)
extractions    (email_id, doc_type[SI/BL], shipper, consignee, notify_party, port_of_loading, port_of_discharge, container_count, gross_weight_kg, confidence)
comparisons    (email_id, defect_fields[], has_defect)
reviews        (email_id, reason, confidence, resolved, corrected_by, corrected_at)