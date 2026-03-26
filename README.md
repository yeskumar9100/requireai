# RequireAI — BRD Intelligence Platform

> Turn business chaos into clear requirements. 9 AI agents extract requirements, stakeholders, and decisions from your emails, meetings, and chats — automatically.

![RequireAI Dashboard](https://img.shields.io/badge/RequireAI-BRD%20Intelligence-6366F1?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)

---

## What is RequireAI?

RequireAI is an AI-powered Business Requirements Document (BRD) generation platform. It solves a real problem: business requirements are buried across emails, meeting transcripts, Slack threads, and scattered documents. Manually synthesizing this into a coherent BRD takes weeks of analyst effort and is error-prone.

RequireAI automates the entire process using a 9-phase multi-agent AI pipeline that extracts, classifies, and structures requirements — then generates a complete, traceable BRD document.

---

## Live Demo

🔗 **[requireai.vercel.app](https://requireai.vercel.app)**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  User Layer — React + Vite + TypeScript             │
│  Dashboard · Upload · Pipeline · BRD · Graph · Chat │
├─────────────────────────────────────────────────────┤
│  Design Layer — Stitch (Google) + Custom CSS        │
│  Dark theme · Antigravity-inspired      │
├─────────────────────────────────────────────────────┤
│  Auth & Database — Supabase                         │
│  PostgreSQL · Row Level Security · Real-time        │
├─────────────────────────────────────────────────────┤
│  AI Intelligence — 9-Phase Agent Pipeline           │
│  Google Gemini 2.5 Flash         │
├─────────────────────────────────────────────────────┤
│  Storage Layer — 12 Supabase Tables                 │
│  Projects · Requirements · Stakeholders · BRDs      │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool and dev server |
| TailwindCSS | 3 | Utility-first styling |
| React Router | 7 | Client-side routing |
| Framer Motion | 11 | Page transitions and animations |
| Recharts | 2 | Dashboard charts (bar, donut, sparkline) |
| react-force-graph-2d | latest | Knowledge graph visualization |
| Lucide React | latest | Icon system |

### Backend & Database
| Technology | Purpose |
|---|---|
| Supabase | PostgreSQL database, Auth, Real-time subscriptions |
| Supabase Auth | Google OAuth, session management |
| Supabase Realtime | Live pipeline progress updates |
| Row Level Security | User data isolation and security |

### AI & Intelligence
| Technology | Purpose |
|---|---|
| Google Gemini 2.0 Flash | Primary extraction model (free tier) |
| Anthropic Claude Sonnet | BRD generation and AI chat |
| Gemini API key rotation | Prevents rate limiting with 2 keys |

### Design & Tooling
| Tool | Purpose |
|---|---|
| Google Stitch | UI design and screen generation |
| Antigravity IDE | AI-powered browser-based development |
| Anthropic MCP | AI agent integration in Antigravity |

---

## Features

### 1. Multi-Source File Ingestion
- Upload **emails** (.txt, .eml, .csv), **meeting transcripts** (.txt, .csv), **chat exports** (.json, .txt, .csv)
- Drag-and-drop file upload with preview
- Accepts any text-based file format
- Files persisted in Supabase — visible on return visits
- Source type tagging (email / meeting / chat)

### 2. 9-Phase AI Extraction Pipeline
Each phase is handled by a specialized AI agent:

| Phase | Agent | Function |
|---|---|---|
| 1 | Project Coordinator | Initializes pipeline, loads sources from Supabase |
| 2 | Document Parser | Reads files, splits into processable chunks |
| 3 | Relevance Scorer | Scores each chunk 0–1 for project relevance, filters noise |
| 4 | Requirements Extractor | Finds functional, non-functional, business, technical requirements |
| 5 | Stakeholder Mapper | Identifies people, roles, influence levels, sentiment |
| 6 | Decision Tracker | Captures confirmed decisions with rationale and owner |
| 7 | Timeline Builder | Extracts milestones, deadlines, dependencies |
| 8 | Conflict Detector | Finds contradictions between extracted requirements |
| 9 | Document Generator | Assembles all intelligence into a complete BRD |

**Rate limit protection:**
- Processes max 15 chunks per run
- 3 second delay between each Gemini API call
- Dual API key rotation on 429 errors
- Skips already-processed chunks on retry
- Real-time progress saved to Supabase after each chunk

### 3. BRD Viewer
Generated BRD document with these sections:
- Executive Summary (AI-generated)
- Stakeholder Analysis (table with influence and sentiment)
- Functional Requirements (numbered REQ-001, REQ-002...)
- Non-Functional Requirements
- Decisions Log (table with owner and rationale)
- Conflicts & Risks (warning cards)
- Timeline & Milestones (vertical timeline)
- Traceability Appendix (source links per requirement)

**Export formats:**
- PDF (browser print with print-optimized CSS)
- Markdown (.md file download)
- DOCX (Word document via docx package)

### 4. Knowledge Graph
- Force-directed interactive graph using react-force-graph-2d
- Node types: Requirements (indigo), Stakeholders (green), Decisions (purple), Conflicts (red), Sources (gray)
- Node size based on priority or influence level
- Click any node to see detail panel
- Filter by entity type
- Empty state with redirect to pipeline if no data

### 5. AI Chat
- Per-project persistent chat history in Supabase
- Calls Claude API with full project context
- Handles natural language commands:
  - "Summarize all requirements"
  - "What conflicts exist?"
  - "Add requirement about mobile support"
  - "Mark REQ-003 as high priority"
- Typing indicator during AI response
- Suggested prompts when chat is empty

### 6. Conflict Resolution
- Lists all detected requirement contradictions
- Severity levels: High / Medium / Low
- Side-by-side view of conflicting requirements
- "Ask AI to Resolve" — calls Claude for suggestion
- "Mark Resolved" — updates status in Supabase
- Filter by severity

### 7. Dashboard
- 4 stat cards with sparkline trend charts
- Requirements by category (bar chart via Recharts)
- Priority breakdown (donut chart via Recharts)
- Projects list with progress bars
- Real-time activity feed from agent logs
- New project creation dialog with navigation

### 8. Authentication
- Google OAuth via Supabase Auth
- Session persistence across page reloads
- AuthGuard component protects all app routes
- Automatic redirect to login if not authenticated
- User profile shown in sidebar

---

## Database Schema

12 Supabase PostgreSQL tables:

```sql
projects          -- Core project entity with status lifecycle
sources           -- Uploaded files and their content
requirements      -- Extracted requirements with category/priority/confidence
stakeholders      -- People with influence levels and sentiment
decisions         -- Confirmed decisions with rationale
timeline_events   -- Milestones and deadlines
conflicts         -- Requirement contradictions with severity
traceability_links-- Knowledge graph edges
documents         -- Generated BRD/PRD with versioning
extraction_runs   -- Pipeline execution tracking
agent_logs        -- Real-time agent activity logs
chat_messages     -- Per-project AI chat history
```

All tables have **Row Level Security (RLS)** enabled — users can only access their own data.

**Real-time subscriptions enabled on:**
- `projects` — dashboard updates live
- `extraction_runs` — pipeline progress
- `agent_logs` — live log messages in pipeline view

---

## Pages & Routes

| Route | Page | Function |
|---|---|---|
| `/` | Landing | Marketing page with particle animation |
| `/login` | Login | Google OAuth sign in |
| `/dashboard` | Dashboard | Stats, charts, projects list, activity feed |
| `/upload/:id` | Upload | Multi-tab file upload (email/meeting/chat) |
| `/pipeline/:id` | Pipeline | 9-phase AI progress with live logs |
| `/brd/:id` | BRD Viewer | Generated document with export options |
| `/graph/:id` | Knowledge Graph | Force-directed entity relationship graph |
| `/chat/:id` | AI Chat | Project-scoped AI assistant |
| `/conflicts/:id` | Conflicts | Conflict detection and resolution |
| `/settings` | Settings | Theme toggle, profile, demo seeding |

---

## Project Structure

```
requireai/
├── public/
│   └── index.html
├── src/
│   ├── main.tsx              # App entry + providers
│   ├── App.tsx               # Routes definition
│   ├── index.css             # Global design system CSS
│   ├── context/
│   │   └── ThemeContext.tsx  # Dark/light mode state
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   └── extraction.ts     # 9-phase AI pipeline logic
│   ├── hooks/
│   │   ├── useAuth.ts        # Auth state hook
│   │   └── useProject.ts     # Project CRUD hooks
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx # Sidebar + titlebar wrapper
│   │   │   ├── Sidebar.tsx   # Navigation sidebar
│   │   │   └── ThemeToggle.tsx
│   │   ├── AuthGuard.tsx     # Route protection
│   │   ├── CopilotFAB.tsx    # Floating AI assistant
│   │   └── ui/               # Shared UI components
│   └── pages/
│       ├── Landing.tsx        # Public landing page
│       ├── Login.tsx          # Auth page
│       ├── Dashboard.tsx      # Main dashboard
│       ├── Upload.tsx         # File upload
│       ├── Pipeline.tsx       # AI pipeline progress
│       ├── BRDViewer.tsx      # BRD document viewer
│       ├── KnowledgeGraph.tsx # Graph visualization
│       ├── Chat.tsx           # AI chat interface
│       ├── Conflicts.tsx      # Conflict resolution
│       └── Settings.tsx       # App settings
├── .env.local                 # Environment variables (not committed)
├── .gitignore
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Design System

### Color Palette (Dark Theme Default)
```css
--bg:    #0A0A0F   /* Page background */
--bg2:   #111118   /* Card background */
--bg3:   #1A1A24   /* Input background */
--blue:  #6366F1   /* Primary / Indigo */
--green: #10B981   /* Success / Emerald */
--orange:#F59E0B   /* Warning / Amber */
--red:   #EF4444   /* Danger / Rose */
--purple:#A855F7   /* Accent / Purple */
```

### Typography
- Font: `-apple-system, BlinkMacSystemFont, Inter`
- Page titles: 20px, weight 600
- Body: 13px, weight 400
- Secondary: 12px, color var(--text2)
- Labels: 11px, uppercase, letter-spacing 0.06em

### Design Inspiration
- **Antigravity** — particle background, dark premium feel
- **Linear** — sidebar navigation, card style
- **Vercel** — typography, spacing, minimalism
- **macOS HIG** — interaction patterns, traffic light dots

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Google Gemini API key (free at aistudio.google.com)
- Anthropic Claude API key (console.anthropic.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/requireai.git
cd requireai

# Install dependencies
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your anon key...
VITE_GEMINI_API_KEY_1=AIza...your first key...
VITE_GEMINI_API_KEY_2=AIza...your second key...
ANTHROPIC_API_KEY=sk-ant-...your key...
```

### Database Setup

1. Create a new Supabase project at supabase.com
2. Go to **SQL Editor**
3. Run the schema from `supabase/schema.sql`
4. Enable Google Auth in **Authentication → Providers**
5. Enable Realtime for tables: `projects`, `extraction_runs`, `agent_logs`

### Run Development Server

```bash
npm run dev
# Opens at http://localhost:5173
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Add environment variables in Vercel dashboard under **Settings → Environment Variables**.

### Deploy to Netlify

```bash
npm run build
# Upload dist/ folder to Netlify
```

---

## How to Use

1. **Sign in** with Google account
2. **Create a project** from the dashboard
3. **Upload files** — emails, meeting transcripts, or chat logs
4. **Start AI Analysis** — 9 agents process your files
5. **Watch pipeline** — real-time progress with live agent logs
6. **View BRD** — complete document with all sections
7. **Explore graph** — visual knowledge graph of all entities
8. **Export** — download as PDF, Markdown, or DOCX
9. **Chat** — ask AI questions about your requirements
10. **Resolve conflicts** — review and fix contradictions

---

## Sample Test File

Create a `.txt` file with this content to test the pipeline:

```
Meeting Notes - Product Team
Attendees: Sarah (PM), John (Dev), Priya (Design)

Sarah: We need user authentication by April 1st.
John: The system must handle 10,000 concurrent users.
Priya: Mobile responsive design is mandatory.
Sarah: We decided to use React for the frontend.
John: API response time must be under 200ms.
Priya: Dark mode support is required.
Sarah: Beta launch deadline is May 15th.
John: We need OAuth with Google and GitHub.
Sarah: The budget is approved for cloud infrastructure.
```

---

## API Rate Limits

| Provider | Model | Free Limit | Our Usage |
|---|---|---|---|
| Google Gemini | gemini-2.0-flash | 15 RPM, 1M TPD | Max 15 chunks, 3s delay |
| Anthropic Claude | claude-sonnet-4 | $5 free credits | BRD generation + chat |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## Known Issues & Roadmap

### Current Known Issues
- [ ] Pipeline shows running without files (guard added)
- [ ] Knowledge graph empty when no pipeline run
- [ ] Dark/light mode toggle needs full page refresh

### Roadmap
- [ ] Slack integration via OAuth
- [ ] Gmail connector for direct email import
- [ ] PDF file parsing with pdfjs-dist
- [ ] Multi-user collaboration on same project
- [ ] BRD version history and diff view
- [ ] Stakeholder email notifications
- [ ] PRD generation alongside BRD
- [ ] Jira/Linear ticket export from requirements

---

## Built With ❤️ For

This project was built for a hackathon focused on AI-powered business tooling. The problem statement required building a BRD Agent that could ingest multi-channel business communications and automatically generate structured, traceable requirement documents.

### Dataset Used
- **Enron Email Dataset** (Kaggle) — real business emails for testing noise filtering
- **AMI Meeting Corpus** (HuggingFace) — meeting transcripts with ground truth summaries
- **Synthetic Slack messages** — generated from email content for chat channel testing

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [Google](https://ai.google.dev) — Gemini API + Stitch design tool
- [Supabase](https://supabase.com) — Database and auth
- [Antigravity](https://antigravity.dev) — AI-powered IDE


---

<div align="center">
  <strong>RequireAI</strong> — Turn business chaos into clear requirements<br/>
  Built with Anthropic Claude + Google Gemini
</div>
