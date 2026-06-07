import json
import sys

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

SA_PATH = r"C:\dev\KkumDream\KKUMDREAM\secrets\google-play-service-account.json"
PACKAGE = "com.kkumdreammobile"
TOKEN = "idhdfibccmpgeoijiklikpkn.AO-J1OxPg0n5"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
BASE = "https://androidpublisher.googleapis.com"

info = json.load(open(SA_PATH, encoding="utf-8"))
print("SA email :", info["client_email"])
print("SA project:", info["project_id"])
print("key_id   :", info["private_key_id"])

creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
creds.refresh(Request())
print("token acquired:", bool(creds.token))
print("-" * 60)

H = {"Authorization": f"Bearer {creds.token}"}


def show(label, resp):
    print(f"[{label}] HTTP {resp.status_code}")
    body = resp.text
    print(body[:600])
    print("-" * 60)


# Test 1: subscription purchase lookup (what the backend does)
r = requests.get(
    f"{BASE}/androidpublisher/v3/applications/{PACKAGE}/purchases/subscriptionsv2/tokens/{TOKEN}",
    headers=H, timeout=20,
)
show("subscriptionsv2.get", r)

# Test 2: general app access — create an edit (no purchase token needed)
r = requests.post(
    f"{BASE}/androidpublisher/v3/applications/{PACKAGE}/edits",
    headers=H, timeout=20,
)
show("edits.insert", r)
