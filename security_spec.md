# Security Specification: PTE Core Reading Coach Firebase Rules

## Data Invariants
1. A Study Card (saved question) can only be accessed or modified by its owner (`userId` field matches `request.auth.uid`).
2. Every Study Card must have a valid non-empty title, category matching one of "FIB-R", "FIB-RW", "RO", "MCQ", "TXT", a status matching one of "needs-review", "mastered", "critical", and a strict creation time or timestamp.
3. Users are strictly prohibited from changing the owner ID (`userId`) or `createdAt` timestamp of a Study Card on updates.
4. Data payloads must be strictly size-limited to prevent Denial-of-Wallet or storage exhaustion attacks.

## The "Dirty Dozen" Payloads (Exploit Vector Vectors Tested for DENIED response)

### 1. Identity Spoofing (Create Card for Another User)
Attempt to create a card with `userId` of `victim_user_abc` while logged in as `attacker_123`.
```json
{
  "id": "card_999",
  "userId": "victim_user_abc",
  "title": "Hack Attempt",
  "category": "TXT",
  "status": "needs-review",
  "images": [],
  "rawResponse": "{}",
  "note": "Attacker notes"
}
```

### 2. State Shortcutting (Illegal Empty Category)
Attempt to save a card missing a valid PTE category category identifier.
```json
{
  "id": "card_001",
  "userId": "attacker_123",
  "title": "Empty Category",
  "category": "",
  "status": "needs-review",
  "images": [],
  "rawResponse": "{}",
  "note": ""
}
```

### 3. Resource Poisoning (Gigantic Title Attack)
Save a card with an over-sized title string (exceeding 256 characters) to exhaust storage.
```json
{
  "id": "card_002",
  "userId": "attacker_123",
  "title": "A".repeat(500),
  "category": "TXT",
  "status": "needs-review",
  "images": [],
  "rawResponse": "{}",
  "note": ""
}
```

### 4. Privilege Escalation (Changing ownerId on Update)
Attempt to update a card's `userId` field to a different user's UID to transfer ownership.
```json
{
  "id": "card_owned",
  "userId": "different_user",
  "title": "Updated Title"
}
```

### 5. Rogue Metadata Injection (Attacker Injection of Shadow Keys)
Attempt to write extra fields (such as `"role": "admin"`) to bypass application level guards.
```json
{
  "id": "card_003",
  "userId": "attacker_123",
  "title": "Shadow Field Card",
  "category": "TXT",
  "status": "needs-review",
  "images": [],
  "rawResponse": "{}",
  "note": "",
  "role": "admin",
  "adminPrivileges": true
}
```

### 6. Anonymous Read Attempt (No Auth Access)
Unauthenticated request to retrieve a private reading study card history.
```json
{}
```

### 7. Global Query Harvester (Insecure List Query without Owner Check)
Attempting a query fetching all study items in the database without matching the currently logged-in user's UID.
```json
{}
```

### 8. Invalid ID Poisoning (Gigantic Document ID)
Enforcing a document write using a massive string ID string (exceeding 128 chars) or containing invalid symbols (escaped parameters).
```json
{}
```

### 9. Word Category Tampering (Rogue Category Input)
Creating a card with a category of `"ADMIN"` or other non-allowed values.
```json
{
  "id": "card_004",
  "userId": "attacker_123",
  "title": "Rogue Category",
  "category": "ADMIN",
  "status": "needs-review",
  "images": [],
  "rawResponse": "{}",
  "note": ""
}
```

### 10. Temporal Spoofing (Manipulating Server-Side request.time on Create)
Passing a manual mock future timeline value for `createdAt`/`timestamp`.
```json
{
  "id": "card_005",
  "userId": "attacker_123",
  "title": "Time Hack",
  "category": "TXT",
  "status": "needs-review",
  "images": [],
  "rawResponse": "{}",
  "note": "",
  "timestamp": 999999999999
}
```

### 11. Overriding Immutable Created Date on Update
Overwriting the original creation date identifier while updating note fields.
```json
{
  "note": "Updated notes only",
  "createdAt": "different_creation_time"
}
```

### 12. PII Blanket Read (Accessing foreign user's collection data)
Attacker issuing a list query for `userId == "victim_uid"` records while authenticated as `"attacker_uid"`.
```json
{}
```

---

## Test Runner Verification Structure
The safety of these rules will be verified with security rule test specifications enforcing that all operations violating these invariants will be rejected with `PERMISSION_DENIED` status.
