import requests

DOCKER_BASE = "http://localhost:8080"

def get_email(email_id):
    return requests.get(f"{DOCKER_BASE}/emails/{email_id}").json()

def get_all_emails():
    return requests.get(f"{DOCKER_BASE}/emails").json()

def get_attachment_text(path):
    return requests.get(f"{DOCKER_BASE}/{path}").text

def get_attachment_bytes(path):
    return requests.get(f"{DOCKER_BASE}/{path}").content