# Seedling — Demo Script & Q&A

## 30-Second Pitch

"Seedling is a civilization simulator where AI agents with real personalities, values, and memories form tribes and govern themselves. We give four tribes the same starting conditions but different levels of willingness to change their rules — from rigid traditionalists to radical anarchists — and watch what happens. The result? AI agents independently discover welfare states, fight for representation, and create inequality — mirroring patterns from real human history."

---

## Demo Flow (3-5 minutes)

### 1. The Setup (30s)

Open the landing page. Show the four tribes:

- **The Keepers** — 85% consensus needed, minor changes only. "Our ancestors' wisdom is absolute."
- **The Moderates** — 80% consensus, small adjustments. Elected leader + advisory council.
- **The Adapters** — 60% consensus, moderate rewrites. Direct democracy.
- **The Free** — 51% consensus, any change allowed. No permanent leaders.

> "Same starting population, same resources, same world events. The only difference is how easily they can change their own rules."

Click "Begin Simulation."

### 2. Live Simulation (60s)

Show the simulation running:
- Point out the **economy stats** (Food, Wealth, Hungry, Pool) — each tribe's economic model is inferred from their rules
- Show a **council deliberation** happening in real-time — agents speaking in character, referencing their memories
- Point out a **proposal** being made and voted on
- Note the different **population sizes** growing

> "Each of these agents is a separate LLM call with its own personality, values, and memories. They don't know they're in a simulation."

### 3. Tribe Detail Page (60s)

Click "Full History" on a tribe. Show:
- **Deliberations tab** — full conversation threads, proposals with vote breakdowns
- **Events tab** — births, deaths, famines, discoveries
- **Members tab** — each agent's personality, values, age

> "Every conversation, every vote, every birth and death is persisted. You can trace exactly why a society evolved the way it did."

### 4. The Findings (60-90s)

Open the report page or reference these talking points:

**Finding 1: The welfare state wins.**
> "The Moderates — with their 20% tax and need-based distribution — ended with the highest wealth (37.2 avg), largest population (41), and fewest deaths. Neither pure communism nor pure freedom matched it."

**Finding 2: The Keepers are in silent revolt.**
> "The most conservative tribe tried to pass the same two reforms — a Speaker's Circle and equitable distribution — 13 times across 80 turns. Rejected every time because of their 85% threshold. Dissent builds but can't find an outlet. Sound familiar?"

**Finding 3: Maximum freedom creates maximum inequality.**
> "The Free had the highest Gini coefficient (0.469) — freedom without structure means the productive thrive and others fall behind. They only passed 1 rule in 125 turns because their rules were already maximally permissive."

**Finding 4: The Moderates independently invented inclusive representation.**
> "Two agents — Star Song and Coral Stone — pushed through rules requiring leaders to seek out quiet voices. No one programmed them to do this. They invented democratic participation quotas on their own."

---

## Possible Questions & Answers

### "How is this different from other agent simulations?"

"Most agent simulations use hard-coded rules. Seedling's rules are natural language — the agents read, interpret, and debate them like real people. The economic model isn't programmed in — it's inferred from the tribe's written rules. When the Keepers' rule says 'all food is stored communally,' the system interprets that as 80% contribution to the communal pool. If they change the rule, the economy actually changes."

### "What LLMs are you using?"

"Gemini 2.5 Flash Lite for bulk agent work — deliberation, voting, value inheritance. It handles the 4K RPM we need for 40+ agents. Gemini 3 Flash for nuanced judgment — evaluating whether a proposed rule change is within a tribe's allowed magnitude of change. The agent's 'soul' is reconstructed from database state before every call — no persistent sessions."

### "How do you handle rate limits with so many agents?"

"Sequential tribe processing, batched agent calls (3 at a time with 2-second delays), sampled voting (max 10 voters per proposal), and truncated conversation context (last 15 messages). A council turn takes about 30 seconds per tribe. We persist everything to PostgreSQL so nothing is lost."

### "Are the results reproducible?"

"No — and that's the point. Each run produces different emergent behavior because the LLM responses vary. But the patterns are consistent: welfare states outperform, rigid societies stagnate, and maximum freedom creates inequality. We've seen this across multiple runs."

### "What's the resource economy?"

"Each agent produces food and wealth based on their age, personality traits, and tech level. Tribe rules determine contribution rates (communal pool) and distribution mode (equal, need-based, merit-based, or none). Parents share food with hungry children. Agents at 0 food have a 40% chance of dying per turn. This creates real stakes — rule changes have life-or-death consequences."

### "How do agents inherit values?"

"When a child is born, their values are generated by the LLM, blending both parents' values with the tribe's current rules and recent history. Children don't perfectly copy their parents — there's natural drift, just like real cultural transmission. A child born during a famine develops different values than one born during prosperity."

### "Why do The Free change so few rules?"

"The paradox of maximum freedom — when your rules already say 'rules are guidelines, not chains' and 'borders are imaginary,' there's nothing to rebel against. The Adapters change more because they have structured rules worth challenging. The Free's permissiveness is their stability."

### "What would you improve next?"

"User-configurable simulation length — right now it's 5 generations, but real cultural transformation takes 20+. We'd also add inter-tribal contact (trade, conflict, cultural exchange), agent skill specialization, and a visualization of economy over time using the per-turn snapshots we already store."

---

## Technical Architecture

```
Frontend:  Next.js 16 + React + TypeScript + Tailwind CSS
Backend:   Next.js API Routes (simulation engine)
Database:  PostgreSQL via Docker (port 5440)
ORM:       Drizzle ORM
AI:        Vercel AI SDK + Google Gemini (Flash Lite + Flash)
Real-time: Server-Sent Events (SSE)
```

### Data Model

```
simulations → tribes → agents (with personalResources, memories, values)
                     → deliberation_threads (full conversation logs)
                     → rule_changes (proposals, votes, pass/fail)
                     → turn_events (world events)
                     → economy_snapshots (per-turn economic metrics)
                     → turns (turn records)
```

### Agent Architecture

Each agent is **reconstructed from DB** before every LLM call:
- System prompt = "soul" (name, age, personality, values, memories, relationships, resources, tribe rules)
- No persistent LLM sessions — stateless by design
- Memory accumulates in DB across turns (decisions, events, outcomes)

### Simulation Loop

```
For each turn:
  For each tribe (sequential):
    1. Economy: produce → contribute → distribute → consume
    2. Deaths (natural + starvation) + Births
    3. Random events (famine, discovery, conflict...)
    4. If council turn:
       a. Generate dilemma (challenges specific existing rules)
       b. Deliberation: agents speak in batches of 3
       c. Parse proposals (add/replace/remove)
       d. Vote with sampled voters (max 10)
       e. Apply passed changes to rules
       f. Save memories, thread, snapshots
```

### Key Numbers

| Metric | Value |
|--------|-------|
| Agents per tribe | 10 starting, grows to 30-40 |
| Council frequency | Every 4 turns |
| Generation length | 25 turns |
| Default simulation | 5 generations = 125 turns |
| API calls per council | ~20-30 per tribe |
| Batch size | 3 agents (with 2s delay) |
| Max voters per proposal | 10 (sampled) |
| Thread context | Last 15 messages |
| Economy per turn | Production → tax → distribution → consumption |

---

## One-Liner Variants

- **For engineers:** "We built a multi-agent civilization simulator where Gemini agents with persistent memory deliberate, vote on rules, and evolve their societies — and discovered the welfare state independently."
- **For product people:** "What if you could watch 4 societies with different governance models evolve side-by-side and see which one actually produces the best outcomes?"
- **For researchers:** "An empirical framework for studying how rule mutability affects societal trajectories, powered by LLM agents with personality-driven deliberation and per-agent resource economics."
