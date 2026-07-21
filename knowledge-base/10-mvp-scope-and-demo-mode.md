# 10 — MVP Scope & Demo Mode

## Overview

The MVP is a fully functional Proof of Concept designed to demonstrate the core value proposition of Sudriv: a producer can manage a live news running order entirely through voice conversation with an AI co-pilot. This document defines exactly what is in scope, what demo data is required, and how Demo Mode works.

---

## What's In Scope (MVP)

### ✅ Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| Single-user authentication | Fixed credentials, Supabase Auth | Required |
| Session setup | Select timeline + optional news category | Required |
| Pre-loaded running orders | 4 timeline templates with realistic segments | Required |
| Pre-loaded news items | 20-30 news items across categories | Required |
| Voice conversation | Full-duplex voice with interruption support | Required |
| Natural language understanding | English + Hindi + Hinglish | Required |
| Running order tools | Read, analyze, propose, apply, push instruction | Required |
| Confirmation workflow | Read → Analyze → Propose → Confirm → Apply | Required |
| Impact analysis | Cascading timing calculations | Required |
| Real-time timeline updates | Supabase Realtime → Frontend | Required |
| Teleprompter sync | Updated on running order change | Required |
| Anchor instruction generation | Clean instruction text after changes | Required |
| Drag-and-drop timeline | Manual reordering via UI | Required |
| Session summary | Post-session statistics | Required |

### ❌ Explicitly Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time news ingestion | Requires web scraping / API integrations |
| Multi-user sessions | Concurrency complexity |
| Real IFB audio to anchor | Hardware integration |
| NRCS integration | Vendor partnerships |
| Live mode (real broadcasts) | Requires regulatory compliance |
| User registration | Single pre-configured user for MVP |
| Role-based access control | Single role (producer) for MVP |
| Session recording / replay | Post-MVP analytics feature |
| Mobile responsive design | PCR is desktop-only |
| Offline support | Always-connected assumption |

---

## Demo Mode Design

### Concept

Demo Mode creates a controlled, reproducible environment where:
1. The running order is pre-loaded from a template (not empty)
2. News items are pre-loaded (not scraped or fetched live)
3. The agent has enough context to demonstrate all capabilities
4. The demo is impressive in under 5 minutes

### Demo Flow (Recommended 5-Minute Script)

```
[0:00] Producer logs in
[0:15] Selects "Breaking News: Earthquake" timeline
[0:30] Clicks "Start Session"
[0:45] Agent greets: "I've loaded the Breaking News running order..."

[1:00] Agent proactively alerts about a high-priority news item:
       "I have a critical update — a 6.2 magnitude earthquake in Gujarat..."

[1:30] Producer: "Yes, show me where it fits"
[1:45] Agent: "I recommend slot 3, after the government response..."
[2:00] Producer: "What happens to the sports segment?"
[2:15] Agent: "Sports moves to slot 5, starts 3 minutes later..."
[2:30] Producer: "Theek hai, apply karo" (Hinglish: OK, apply it)
[2:35] Timeline updates on screen
       Teleprompter updates
       Anchor instruction appears

[3:00] Producer: "Actually, move the weather to slot 2"
[3:15] Agent runs impact analysis, proposes change
[3:30] Producer: "No, keep it where it is"
[3:35] Agent: "Got it, no changes"

[4:00] Producer: "End session"
[4:15] Session summary displayed
[4:30] Demo complete
```

---

## Seed Data Specification

### Timeline Template 1: Morning Bulletin

```json
{
  "name": "Morning Bulletin",
  "description": "Standard 30-minute morning news bulletin with weather and sports",
  "default_duration_seconds": 1800,
  "category": "general",
  "default_segments": [
    {
      "position": 1,
      "title": "Headlines",
      "slug": "headlines",
      "segment_type": "headlines",
      "duration_seconds": 120,
      "teleprompter_text": "Good morning, I'm [Anchor Name]. Here are the top stories this morning. In our top story today, the government has announced a new economic reform package aimed at boosting manufacturing. We'll have full details coming up. Also ahead, monsoon rains cause flooding in several northern states, and in sports, India prepares for the crucial test match against Australia."
    },
    {
      "position": 2,
      "title": "Economic Reform Package",
      "slug": "economic-reform",
      "segment_type": "package",
      "duration_seconds": 300,
      "teleprompter_text": "The Union Finance Ministry today unveiled a comprehensive economic reform package worth an estimated two lakh crore rupees. The package focuses on three key areas: manufacturing incentives, small business support, and digital infrastructure. Our correspondent Rajesh Sharma has the details."
    },
    {
      "position": 3,
      "title": "Monsoon Flooding",
      "slug": "monsoon-flooding",
      "segment_type": "live",
      "duration_seconds": 240,
      "teleprompter_text": "Heavy monsoon rains have caused widespread flooding across Uttar Pradesh and Bihar, displacing over fifty thousand families. The NDRF has deployed teams in the worst-affected districts. We go live to our correspondent Priya Singh in Patna."
    },
    {
      "position": 4,
      "title": "Political Developments",
      "slug": "political-developments",
      "segment_type": "package",
      "duration_seconds": 240,
      "teleprompter_text": "In political news, the opposition has called for a special parliamentary session to discuss the rising fuel prices. The demand comes after petrol prices crossed the hundred-and-ten rupee mark in several metropolitan cities."
    },
    {
      "position": 5,
      "title": "International News Roundup",
      "slug": "international-roundup",
      "segment_type": "package",
      "duration_seconds": 180,
      "teleprompter_text": "Turning to international news. The United Nations Security Council has held an emergency meeting on the situation in the Middle East. Meanwhile, the European Union has announced new climate targets for 2035."
    },
    {
      "position": 6,
      "title": "Sports Update",
      "slug": "sports-update",
      "segment_type": "sports",
      "duration_seconds": 240,
      "teleprompter_text": "In sports, the Indian cricket team is gearing up for the fourth test match against Australia at the Gabba in Brisbane. Captain Rohit Sharma addressed the media today, expressing confidence in the team's preparation. In football, the ISL season kicks off this weekend with a blockbuster opening match."
    },
    {
      "position": 7,
      "title": "Weather Forecast",
      "slug": "weather",
      "segment_type": "weather",
      "duration_seconds": 120,
      "teleprompter_text": "Now for the weather. The IMD has issued a yellow alert for heavy rainfall across the western coast. Mumbai and Goa can expect intermittent showers throughout the day. Delhi will see clear skies with temperatures around 34 degrees. Chennai remains hot and humid."
    },
    {
      "position": 8,
      "title": "Closing",
      "slug": "closing",
      "segment_type": "closing",
      "duration_seconds": 60,
      "teleprompter_text": "That's all for this morning's bulletin. Stay tuned for continuous updates throughout the day. I'm [Anchor Name], thank you for watching."
    }
  ]
}
```

### Timeline Template 2: Breaking News — Earthquake

```json
{
  "name": "Breaking News: Earthquake",
  "description": "Developing earthquake story with live updates and rolling coverage",
  "default_duration_seconds": 2700,
  "category": "breaking",
  "default_segments": [
    {
      "position": 1,
      "title": "Breaking News Alert",
      "slug": "breaking-alert",
      "segment_type": "headlines",
      "duration_seconds": 120,
      "teleprompter_text": "We are interrupting our regular programming to bring you breaking news. Reports are coming in of a major earthquake in the western region of India. We have limited details at this point, but we're working to bring you the latest information."
    },
    {
      "position": 2,
      "title": "Initial Report — Earthquake Details",
      "slug": "earthquake-initial",
      "segment_type": "live",
      "duration_seconds": 300,
      "teleprompter_text": "The Indian Meteorological Department has confirmed a magnitude 5.8 earthquake centered near Rajkot in Gujarat. The tremor was felt across western Gujarat and parts of Rajasthan. We're now getting initial reports from the affected area. Let's go to our correspondent Meera Patel who is on the ground."
    },
    {
      "position": 3,
      "title": "Government Response",
      "slug": "govt-response",
      "segment_type": "live",
      "duration_seconds": 360,
      "teleprompter_text": "The Chief Minister of Gujarat has convened an emergency meeting and directed all district collectors to assess the damage. The NDRF has been put on high alert, and four teams have been dispatched to the epicenter region. The Prime Minister's office has issued a statement expressing concern."
    },
    {
      "position": 4,
      "title": "Expert Analysis — Seismology",
      "slug": "expert-analysis",
      "segment_type": "interview",
      "duration_seconds": 420,
      "teleprompter_text": "Joining us now is Dr. Arun Bhatia, senior seismologist from the Indian Institute of Seismological Research. Dr. Bhatia, thank you for joining us. Can you tell us about the significance of this earthquake and what aftershocks we might expect?"
    },
    {
      "position": 5,
      "title": "Ground Reports — Affected Areas",
      "slug": "ground-reports",
      "segment_type": "live",
      "duration_seconds": 480,
      "teleprompter_text": "We're now receiving ground reports from multiple locations across the affected region. Let's first go to Rajkot where our reporter Vikram Singh has the latest."
    },
    {
      "position": 6,
      "title": "Updates and Wrap",
      "slug": "updates-wrap",
      "segment_type": "closing",
      "duration_seconds": 120,
      "teleprompter_text": "We will continue to bring you updates as this story develops. If you are in the affected region, please follow all safety guidelines issued by the authorities. Emergency helpline numbers are on your screen. Stay with us for continuous coverage."
    }
  ]
}
```

### Timeline Template 3: Election Night Special

```json
{
  "name": "Election Night Special",
  "description": "60-minute election results coverage with analysis and live updates",
  "default_duration_seconds": 3600,
  "category": "election",
  "default_segments": [
    {
      "position": 1,
      "title": "Welcome & Overview",
      "slug": "welcome-overview",
      "segment_type": "headlines",
      "duration_seconds": 180,
      "teleprompter_text": "Good evening and welcome to our Election Night Special. The votes have been counted and results are now coming in from across the state. Tonight we bring you comprehensive coverage of what is shaping up to be a historic election."
    },
    {
      "position": 2,
      "title": "Early Trends",
      "slug": "early-trends",
      "segment_type": "package",
      "duration_seconds": 300,
      "teleprompter_text": "Let's look at the early trends. As of this hour, counting has been completed in 45 out of 230 constituencies. The ruling party is leading in 28 seats, while the opposition alliance is ahead in 15. Two seats are too close to call."
    },
    {
      "position": 3,
      "title": "Key Constituency — CM Seat",
      "slug": "key-constituency-cm",
      "segment_type": "live",
      "duration_seconds": 300,
      "teleprompter_text": "All eyes are on the Chief Minister's own constituency where the race is extremely tight. Let's go live to our correspondent at the counting center."
    },
    {
      "position": 4,
      "title": "Expert Panel — Analysis",
      "slug": "expert-panel",
      "segment_type": "interview",
      "duration_seconds": 420,
      "teleprompter_text": "Let's bring in our expert panel for analysis. Joining us tonight are political commentator Dr. Shekhar Gupta, psephologist Prannoy Roy, and former election commissioner SY Quraishi."
    },
    {
      "position": 5,
      "title": "Party Headquarters — Ruling Party",
      "slug": "ruling-party-hq",
      "segment_type": "live",
      "duration_seconds": 240,
      "teleprompter_text": "Let's now go to the ruling party headquarters where celebrations — or commiserations — are already underway."
    },
    {
      "position": 6,
      "title": "Party Headquarters — Opposition",
      "slug": "opposition-hq",
      "segment_type": "live",
      "duration_seconds": 240,
      "teleprompter_text": "And now to the opposition camp. What's the mood there?"
    },
    {
      "position": 7,
      "title": "Updated Trends & Projections",
      "slug": "updated-trends",
      "segment_type": "package",
      "duration_seconds": 300,
      "teleprompter_text": "Let's update our numbers. With 120 out of 230 seats now declared, here's where we stand."
    },
    {
      "position": 8,
      "title": "Key Upsets",
      "slug": "key-upsets",
      "segment_type": "package",
      "duration_seconds": 240,
      "teleprompter_text": "Some major upsets are emerging tonight. In what many are calling the surprise of the night, the sitting Home Minister has lost his seat."
    },
    {
      "position": 9,
      "title": "Social Media & Public Reaction",
      "slug": "social-media",
      "segment_type": "package",
      "duration_seconds": 180,
      "teleprompter_text": "Social media is buzzing with reactions to tonight's results. Let's look at what people are saying."
    },
    {
      "position": 10,
      "title": "Market Impact Preview",
      "slug": "market-impact",
      "segment_type": "package",
      "duration_seconds": 180,
      "teleprompter_text": "Financial markets will open tomorrow to these results. Our business editor has a preview of what to expect."
    },
    {
      "position": 11,
      "title": "Late Results & Final Trends",
      "slug": "late-results",
      "segment_type": "package",
      "duration_seconds": 300,
      "teleprompter_text": "With most seats now declared, let's look at the near-final picture."
    },
    {
      "position": 12,
      "title": "Closing & What's Next",
      "slug": "closing",
      "segment_type": "closing",
      "duration_seconds": 120,
      "teleprompter_text": "That brings us to the end of tonight's election special. We'll be back with a morning special at 6 AM with final results and analysis of what this election means for the country. Thank you for watching."
    }
  ]
}
```

### Timeline Template 4: Evening Prime

```json
{
  "name": "Evening Prime",
  "description": "Standard 30-minute evening prime-time news with debate segment",
  "default_duration_seconds": 1800,
  "category": "general",
  "default_segments": [
    {
      "position": 1,
      "title": "Headlines",
      "slug": "headlines",
      "segment_type": "headlines",
      "duration_seconds": 120,
      "teleprompter_text": "Good evening, welcome to the Evening Prime. Tonight's top stories."
    },
    {
      "position": 2,
      "title": "Lead Story — Budget Impact",
      "slug": "lead-budget",
      "segment_type": "package",
      "duration_seconds": 300,
      "teleprompter_text": "In our lead story tonight, the economic fallout from this week's budget announcement continues."
    },
    {
      "position": 3,
      "title": "Political Reactions",
      "slug": "political-reactions",
      "segment_type": "package",
      "duration_seconds": 240,
      "teleprompter_text": "Political reactions have been pouring in throughout the day."
    },
    {
      "position": 4,
      "title": "Prime Debate — Budget Winners & Losers",
      "slug": "prime-debate",
      "segment_type": "interview",
      "duration_seconds": 360,
      "teleprompter_text": "Let's bring in our panel for tonight's Prime Debate."
    },
    {
      "position": 5,
      "title": "Technology & Business",
      "slug": "tech-business",
      "segment_type": "package",
      "duration_seconds": 180,
      "teleprompter_text": "In technology news, India's largest IT company has reported strong quarterly results."
    },
    {
      "position": 6,
      "title": "International Developments",
      "slug": "international",
      "segment_type": "package",
      "duration_seconds": 120,
      "teleprompter_text": "On the international front."
    },
    {
      "position": 7,
      "title": "Entertainment",
      "slug": "entertainment",
      "segment_type": "package",
      "duration_seconds": 120,
      "teleprompter_text": "In entertainment news."
    },
    {
      "position": 8,
      "title": "Sports",
      "slug": "sports",
      "segment_type": "sports",
      "duration_seconds": 180,
      "teleprompter_text": "And now to sports."
    },
    {
      "position": 9,
      "title": "Weather",
      "slug": "weather",
      "segment_type": "weather",
      "duration_seconds": 90,
      "teleprompter_text": "Here's the weather outlook."
    },
    {
      "position": 10,
      "title": "Closing",
      "slug": "closing",
      "segment_type": "closing",
      "duration_seconds": 90,
      "teleprompter_text": "That's all for tonight's Evening Prime. Good night."
    }
  ]
}
```

---

## Pre-loaded News Items

These are the news items available for the agent to propose adding to the running order.

### Critical Priority

```json
[
  {
    "headline": "6.2 Magnitude Earthquake Strikes Gujarat",
    "summary": "A powerful 6.2 magnitude earthquake has struck the Kutch region of Gujarat. Tremors felt across western India including Mumbai. NDRF teams deployed.",
    "content": "Breaking news — the Indian Meteorological Department has confirmed a 6.2 magnitude earthquake centered in the Kutch district of Gujarat at a depth of 10 kilometers. The earthquake struck at approximately 2:15 PM IST. Tremors were felt across western Gujarat, parts of Rajasthan, and as far as Mumbai. Initial reports suggest structural damage in several villages near the epicenter. The National Disaster Response Force has deployed six teams to the affected area. The Gujarat Chief Minister has called an emergency cabinet meeting. Residents in affected areas are being advised to stay in open spaces and follow earthquake safety protocols. We will bring you more details as they come in.",
    "category": "general",
    "priority": "critical",
    "estimated_duration_seconds": 180,
    "source": "IMD / NDRF"
  },
  {
    "headline": "Major Train Derailment in Odisha — Casualties Reported",
    "summary": "A passenger express train has derailed near Balasore, Odisha. Multiple casualties reported. Rescue operations underway.",
    "content": "We're receiving reports of a major train accident in Odisha. The Coromandel Express has derailed near Balasore station with multiple coaches overturning. At least 30 casualties have been reported with the number expected to rise. The Railway Ministry has ordered an immediate inquiry. NDRF and SDRF teams are at the site conducting rescue operations. Railway helpline numbers have been activated.",
    "category": "general",
    "priority": "critical",
    "estimated_duration_seconds": 240,
    "source": "Indian Railways / PTI"
  }
]
```

### High Priority

```json
[
  {
    "headline": "RBI Announces Emergency Rate Cut",
    "summary": "The Reserve Bank of India has announced a surprise 50 basis point rate cut to combat economic slowdown.",
    "content": "In a surprise move, RBI Governor has announced a 50 basis point cut in the repo rate, bringing it down to 5.65 percent. This is the steepest single cut in over a decade. The Governor cited growing concerns about economic growth and the need for monetary stimulus. Markets have reacted positively with the Sensex jumping 800 points.",
    "category": "business",
    "priority": "high",
    "estimated_duration_seconds": 180,
    "source": "RBI"
  },
  {
    "headline": "India Wins Crucial Test Match Against Australia",
    "summary": "India clinches a dramatic 3-wicket victory in the fourth test at Gabba, taking a 2-1 series lead.",
    "content": "In a sensational finish at the Gabba, India have beaten Australia by 3 wickets to take a 2-1 lead in the series. Rishabh Pant scored an unbeaten 89 off 138 balls in one of the greatest test match innings in recent memory. This is India's first test win at the Gabba in 32 years.",
    "category": "sports",
    "priority": "high",
    "estimated_duration_seconds": 180,
    "source": "BCCI / Sports Desk"
  },
  {
    "headline": "Supreme Court Landmark Verdict on Privacy Rights",
    "summary": "The Supreme Court has delivered a landmark 7-0 verdict declaring privacy as a fundamental right.",
    "content": "In a historic unanimous verdict, the nine-judge constitution bench of the Supreme Court has declared that the right to privacy is a fundamental right under Article 21 of the Constitution. This landmark judgment has far-reaching implications for data protection, surveillance, and personal autonomy in India.",
    "category": "politics",
    "priority": "high",
    "estimated_duration_seconds": 240,
    "source": "Supreme Court / Legal Desk"
  },
  {
    "headline": "Cyclone Biparjoy Makes Landfall on Gujarat Coast",
    "summary": "Cyclone Biparjoy has made landfall near Jakhau port with winds up to 150 kmph. Mass evacuation completed.",
    "content": "Cyclone Biparjoy has made landfall on the Gujarat coast near Jakhau port in Kutch district with wind speeds of up to 150 kilometers per hour. Over one lakh fifty thousand people were evacuated from coastal areas in the past 48 hours. The cyclone is expected to weaken as it moves inland over the next 12 hours.",
    "category": "general",
    "priority": "high",
    "estimated_duration_seconds": 200,
    "source": "IMD"
  }
]
```

### Medium Priority

```json
[
  {
    "headline": "New Metro Line Inaugurated in Mumbai",
    "summary": "PM inaugurates the Colaba-Bandra-SEEPZ metro line, Mumbai's first underground metro.",
    "content": "The Prime Minister today inaugurated Mumbai's first underground metro line, the Colaba-Bandra-SEEPZ corridor, also known as Metro Line 3. The 33-kilometer line connects south Mumbai to the western suburbs with 27 stations. The project, which cost over 37,000 crore rupees, is expected to reduce road congestion by 35 percent.",
    "category": "general",
    "priority": "medium",
    "estimated_duration_seconds": 150,
    "source": "MMRDA"
  },
  {
    "headline": "ISRO Launches Communication Satellite",
    "summary": "ISRO successfully launches GSAT-24 communication satellite from Sriharikota.",
    "content": "The Indian Space Research Organisation has successfully launched the GSAT-24 communication satellite from the Satish Dhawan Space Centre in Sriharikota. The satellite, weighing 4,180 kilograms, will provide television and communication services across the Indian subcontinent.",
    "category": "general",
    "priority": "medium",
    "estimated_duration_seconds": 120,
    "source": "ISRO"
  },
  {
    "headline": "IPL Auction — Record Breaking Bid",
    "summary": "Young Indian all-rounder fetches record-breaking 24.75 crore bid at IPL mega auction.",
    "content": "The IPL mega auction saw records tumble as a young Indian all-rounder was bought for a staggering 24 crore 75 lakh rupees, the highest ever bid in IPL history. The intense bidding war lasted over 15 minutes involving four franchises.",
    "category": "sports",
    "priority": "medium",
    "estimated_duration_seconds": 120,
    "source": "BCCI / IPL"
  },
  {
    "headline": "Delhi Air Quality Reaches Severe Category",
    "summary": "Delhi's AQI crosses 450 mark as stubble burning intensifies in neighboring states.",
    "content": "Delhi's air quality has reached the severe category with the Air Quality Index crossing the 450 mark in several monitoring stations. The spike coincides with peak stubble burning season in Punjab and Haryana. The CPCB has advised people to avoid outdoor activities.",
    "category": "general",
    "priority": "medium",
    "estimated_duration_seconds": 150,
    "source": "CPCB"
  },
  {
    "headline": "Bollywood Box Office — New Record",
    "summary": "Latest Bollywood blockbuster crosses 500 crore mark in just 10 days.",
    "content": "The latest Bollywood action thriller has crossed the 500 crore mark at the box office in just 10 days, making it the fastest film to reach this milestone in Indian cinema history.",
    "category": "entertainment",
    "priority": "medium",
    "estimated_duration_seconds": 90,
    "source": "Entertainment Desk"
  }
]
```

### Low Priority

```json
[
  {
    "headline": "New Health Guidelines for Monsoon Season",
    "summary": "Health Ministry issues new guidelines to prevent monsoon-related diseases.",
    "content": "The Union Health Ministry has issued comprehensive guidelines for the monsoon season, focusing on prevention of dengue, malaria, and waterborne diseases.",
    "category": "general",
    "priority": "low",
    "estimated_duration_seconds": 90,
    "source": "Health Ministry"
  },
  {
    "headline": "Cultural Festival Opens in Jaipur",
    "summary": "The annual Jaipur Literature Festival kicks off with record attendance.",
    "content": "The Jaipur Literature Festival, the world's largest free literary festival, has opened its doors for the 2025 edition with over 300 speakers and writers from 30 countries.",
    "category": "entertainment",
    "priority": "low",
    "estimated_duration_seconds": 90,
    "source": "Culture Desk"
  },
  {
    "headline": "Indian-Origin CEO Appointed at Global Tech Firm",
    "summary": "Indian-origin executive appointed as CEO of a Fortune 500 technology company.",
    "content": "Another Indian-origin executive has reached the top of corporate America. The board of a Fortune 500 technology company has appointed an IIT and Stanford alumnus as its new CEO.",
    "category": "business",
    "priority": "low",
    "estimated_duration_seconds": 90,
    "source": "Business Desk"
  }
]
```

---

## Seed Script

The seed script should be idempotent (safe to run multiple times) and should:

1. Create the demo user in Supabase Auth
2. Insert the user record in the `users` table
3. Insert all 4 timeline templates
4. Insert all ~15-20 news items
5. Clear any existing sessions (clean slate)

```sql
-- File: packages/database/supabase/seed.sql

-- Note: The demo user must be created via Supabase Auth API or dashboard
-- Email: producer@sudriv.demo
-- Password: sudriv-demo-2025

-- Insert user record (the id must match the Supabase Auth user id)
INSERT INTO users (id, email, display_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',  -- Replace with actual Auth UID
    'producer@sudriv.demo',
    'Producer',
    'producer'
) ON CONFLICT (email) DO NOTHING;

-- Insert timeline templates
INSERT INTO timelines_library (name, description, default_duration_seconds, category, default_segments)
VALUES
    ('Morning Bulletin', 'Standard 30-minute morning news...', 1800, 'general', '...'::jsonb),
    ('Breaking News: Earthquake', 'Developing earthquake story...', 2700, 'breaking', '...'::jsonb),
    ('Election Night Special', '60-minute election results...', 3600, 'election', '...'::jsonb),
    ('Evening Prime', 'Standard 30-minute evening...', 1800, 'general', '...'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert news items
INSERT INTO news_items (headline, summary, content, category, priority, estimated_duration_seconds, source)
VALUES
    ('6.2 Magnitude Earthquake Strikes Gujarat', '...', '...', 'general', 'critical', 180, 'IMD / NDRF'),
    -- ... (all other news items)
ON CONFLICT DO NOTHING;

-- Clean up any stale sessions
DELETE FROM sessions WHERE status != 'ended';
```

---

## Demo Environment Checklist

Before running a demo, verify:

- [ ] Supabase project is running and accessible
- [ ] Demo user exists in Supabase Auth
- [ ] Seed data is loaded (4 templates, 15+ news items)
- [ ] Redis (Upstash) is accessible
- [ ] LiveKit Cloud is accessible
- [ ] Groq API key is valid
- [ ] Sarvam API key is valid
- [ ] Frontend is deployed and accessible
- [ ] Agent worker is running and registered with LiveKit
- [ ] Microphone permissions are granted in the browser
- [ ] Audio output is working (speakers/headphones)
- [ ] Network latency to LiveKit Cloud is < 100ms
