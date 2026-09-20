from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import classify, extract, compare, review, si_creation
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classify.router)
app.include_router(extract.router)
app.include_router(compare.router)
app.include_router(review.router)
app.include_router(si_creation.router)

@app.get("/health")
def health():
    return {"status": "backend is running"}

