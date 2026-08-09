# AI Detection Model Plan — Fraud, Harassment & Phishing Detection

*Replaces the rule-based demo engine with an actual trainable ML system.*

## 1. Problem Framing

This is a **multi-label text classification** problem, not a single yes/no classifier. A message can carry more than one signal at once (e.g., urgency + money request + impersonation).

**Labels (v1):**
- `scam_fraud` — payment pressure, fake prizes, fake refunds
- `phishing` — malicious links, credential harvesting
- `job_investment_scam` — unrealistic offers, guaranteed returns
- `impersonation` — posing as a bank, company, or authority
- `harassment` — abusive language, unwanted repeated contact
- `threat_blackmail` — coercion, threats of harm or exposure
- `romance_scam` — emotional manipulation + eventual money request
- `spam` — low-severity noise, not a safety risk but useful to separate out

**Output per message:** a probability score per label → aggregated into the single `risk_level` (low/medium/high) and `reasons[]` your product already shows.

Also worth tracking **conversation-level features**, not just single messages — e.g., a scam often escalates over several messages (friendly → urgency → payment request). A model that only looks at one message at a time will miss that pattern. Plan for a v2 that considers the last N messages as context, not just the current one.

## 2. Language Reality Check

Your example messages are Hinglish (Hindi written in Latin script, mixed with English) — this matters a lot for model choice:
- A plain English-only model (e.g., base BERT/DistilBERT) will perform poorly on code-mixed text
- Better starting points: **XLM-RoBERTa**, **IndicBERT**, or **MuRIL** (Google's model built specifically for Indian languages + code-mixing)
- Decide your actual target languages/scripts now — this affects both data collection and model choice from day one

## 3. Data Strategy (this is the hard part, not the model)

Model architecture is the easy 20%. Getting labeled data is the hard 80%.

**Sources to combine:**
- Public datasets: SMS Spam Collection, phishing email/URL datasets (Kaggle, UCI), existing hate-speech/harassment datasets (HASOC — has Hindi-English code-mixed data)
- Synthetic data: generate realistic scam/harassment message variations (an LLM can help draft these — mark clearly as synthetic and validate against real examples)
- Volunteer-contributed real examples: team members' own experience with spam/scam texts (with consent, anonymized)
- **What you cannot ethically do:** scrape real people's private messages without consent, even "for a good cause." This is a hard line, not a shortcut to skip.

**Labeling process:**
- Each message gets 7 binary labels (one per category above) + free-text `reason` for High risk to help evaluate explanation quality later
- Use 2+ labelers per message minimum, resolve disagreements — this is where your Research & Testing pair spends real time
- Aim for a few thousand labeled examples minimum before first training run; a few hundred won't generalize

## 4. Model Approach — Staged, Not All at Once

**Stage 1 (matches your current MVP): Rule-based + lightweight classifier**
- Keep the rule-based patterns as a *fast first pass* (catches obvious cases instantly, zero training needed)
- Add a lightweight classifier (e.g., logistic regression or linear SVM on TF-IDF features) trained on your first labeled batch, as a second pass for anything rules miss
- This stage is realistic to ship within your existing Phase 5 timeline

**Stage 2: Fine-tuned transformer**
- Fine-tune MuRIL/XLM-R on your labeled dataset for multi-label classification
- Needs a GPU for training (Colab/Kaggle free tier is enough at this data scale) but can run inference on CPU for a while
- This is where real accuracy gains happen — budget real time here, not a weekend

**Stage 3 (post-MVP): Conversation-level context**
- Feed the last few messages, not just one, into the model
- Catches slow-building scams that stage 1–2 will miss

## 5. Evaluation — Precision Matters More Than Recall Here

For a safety feature, **false positives are more damaging than false negatives** early on — flag too much and users disable the feature entirely, which means it protects no one.

- Track **precision** and **recall** separately per label, not just overall accuracy
- Set a higher confidence threshold for showing a "High risk" warning than for logging internally — err toward Medium when uncertain
- Build a small held-out test set of real (or realistic) messages your team did NOT train on, and re-test after every model change
- Track false-positive rate on *normal, benign* conversations specifically — pull a sample of harmless chat and confirm the model stays quiet

## 6. Deployment Path

| Stage | Where it runs | Notes |
|---|---|---|
| MVP | Server-side (AI Safety Engine service, per the architecture doc) | Simplest to ship and iterate on |
| Later | On-device (mobile) | Needed for the stated privacy goal — TensorFlow Lite / ONNX Runtime Mobile for a distilled/quantized version of the model |

Server-side first is the right call for MVP speed — just don't let "later" become "never," since on-device inference is core to your privacy promise, not a nice-to-have.

## 7. What Your AI/NLP Pair Should Actually Do, In Order

1. Lock the label taxonomy above (or your revised version) — don't start collecting data before this is fixed, relabeling is expensive
2. Build the labeled dataset (v1: few thousand examples, 2-labeler agreement)
3. Ship Stage 1 (rules + lightweight classifier) — this can plug directly into the `/internal/analyze` contract already defined
4. Evaluate precision/recall, tune thresholds
5. Only then move to Stage 2 fine-tuning — resist the urge to jump to a transformer before you have real labeled data to fine-tune it on
