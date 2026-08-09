# System Architecture & API Spec — AI Safe Communication Platform (v1 / MVP)

## 1. High-Level Architecture

```
[Client App]  <-- WebSocket (real-time) + REST (auth, history) -->  [API Gateway]
                                                                          |
                        -----------------------------------------------------------------
                        |                     |                     |                   |
                  [Auth Service]      [Chat Service]        [AI Safety Engine]   [Media Storage]
                        |                     |                     |                   |
                    [User DB]           [Message DB]          [Detection Models]   [Cloud Storage/S3]
```

**Flow for a sent message:**
1. Client sends message via WebSocket to Chat Service
2. Chat Service stores it in Message DB and forwards a copy (text only) to the AI Safety Engine, async
3. AI Safety Engine returns a risk result within ~1–2 seconds
4. Chat Service pushes the message to the recipient immediately (never blocked on AI analysis)
5. If risk is Medium/High, a risk annotation is pushed as a follow-up event and rendered as a warning badge on that message

This keeps messaging fast (no waiting on AI) while still surfacing warnings quickly after.

---

## 2. Core Services

### Auth Service
- Phone number or email + OTP verification
- Issues JWT access token + refresh token
- Handles 2FA (Phase 6, not MVP-blocking)

### Chat Service
- WebSocket connection management (presence, delivery, typing indicators)
- Message persistence, delivery receipts
- Media upload handoff to Cloud Storage

### AI Safety Engine
- Receives message text (+ minimal context: conversation risk history)
- Runs detection models, returns: `risk_level`, `risk_score`, `reasons[]`
- Stateless per-message; conversation-level risk is aggregated by Chat Service, not stored redundantly here
- Designed so this service can run **on-device** later (privacy goal) without changing the API contract

### Media & Evidence Storage
- Encrypted at rest
- Evidence saves are opt-in, tied to explicit user action, never automatic

---

## 3. Database Schema (MVP)

**users**
| field | type | notes |
|---|---|---|
| id | UUID | PK |
| phone_or_email | string | unique, indexed |
| display_name | string | |
| created_at | timestamp | |
| public_key | string | for future E2E encryption |

**conversations**
| field | type | notes |
|---|---|---|
| id | UUID | PK |
| participant_ids | UUID[] | MVP: exactly 2 (1-to-1 only) |
| created_at | timestamp | |
| risk_level | enum(low/medium/high) | denormalized, updated on new flagged message |

**messages**
| field | type | notes |
|---|---|---|
| id | UUID | PK |
| conversation_id | UUID | FK |
| sender_id | UUID | FK |
| content | text | |
| media_url | string, nullable | |
| sent_at | timestamp | |
| risk_level | enum(low/medium/high), nullable | |
| risk_reasons | string[], nullable | |

**evidence_reports**
| field | type | notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | who saved it |
| conversation_id | UUID | FK |
| message_ids | UUID[] | messages included in the report |
| created_at | timestamp | |
| status | enum(saved/submitted) | |

---

## 4. REST API Endpoints (MVP)

**Auth**
```
POST /auth/request-otp        { phone_or_email }
POST /auth/verify-otp         { phone_or_email, otp }              -> { access_token, refresh_token }
POST /auth/refresh            { refresh_token }                     -> { access_token }
```

**Users**
```
GET  /users/me                                                      -> current user profile
PATCH /users/me               { display_name }
```

**Conversations**
```
GET  /conversations                                                  -> list, with last message + risk_level
POST /conversations           { participant_id }                     -> creates or returns existing 1-to-1 thread
GET  /conversations/:id/messages?before=&limit=                     -> paginated history
```

**Evidence**
```
POST /conversations/:id/evidence   { message_ids[] }                -> creates evidence_report
GET  /evidence/:id                                                   -> report detail, exportable
```

**Reporting / Blocking**
```
POST /users/:id/block
POST /users/:id/report        { reason, evidence_report_id? }
```

## 5. WebSocket Events

**Client → Server**
```
message:send      { conversation_id, content }
typing:start       { conversation_id }
```

**Server → Client**
```
message:new        { message object }
message:risk_flag  { message_id, risk_level, risk_reasons[] }   // sent async, shortly after message:new
presence:update     { user_id, status }
```

## 6. AI Safety Engine — Internal Contract

```
POST /internal/analyze
Request:  { message_text, conversation_id, sender_id, recent_context?: string[] }
Response: {
  risk_level: "low" | "medium" | "high",
  risk_score: number,
  reasons: [ { pattern: string, label: string } ]
}
```
Kept as an internal service (not client-facing) so the detection model can be swapped, retrained, or moved on-device without touching the client API.

## 7. Security Notes for MVP
- All traffic over TLS
- JWT short-lived access tokens (15 min) + refresh token rotation
- Rate limiting on `/auth/request-otp` (prevent OTP spam/abuse)
- Message content encrypted at rest in the database
- AI Safety Engine gets message content only — no access to auth credentials or unrelated user data

## 8. What's deliberately deferred past MVP
- Full end-to-end encryption (Signal Protocol) — v1 uses TLS + at-rest encryption only; document this clearly to users so expectations are accurate
- Group conversation fan-out logic
- On-device model execution (v1 runs detection server-side for simplicity; architecture above is designed to migrate later)
