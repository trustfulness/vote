# Event Voting System

A complete web-based voting system for groups to vote on preferred options (Venue, Date, etc.). Members can cast votes, view real-time results, and see who has voted. Perfect for event planning, team decisions, or any group voting scenario.

## Features

- ✅ Members vote on multiple categories (Venue, Date, etc.)
- 📊 Real-time results with percentage bars
- 👥 Member list with voting status tracking
- 🌐 Bilingual support (English & Traditional Chinese)
- 🔄 Auto-refresh every 10 seconds
- 📱 Mobile-friendly responsive design
- 💾 Google Sheets backend (free, no database needed)
- 🔒 Each member can only vote once

## Demo

1. Open `vote.html` in your browser (or host on GitHub Pages)
2. Select your name from the member list
3. Vote for your preferred options in each category
4. View live results showing vote counts and percentages

## How It Works

### Google Sheets Structure

**Questions Sheet** - Contains members and voting options:
| Name | Venue | Date |
|------|-------|------|
| Johnny Li | JW Hotel | 2026-05-30 |
| Carmen Tam | Angus Café | 2026-06-06 |
| Jason Wu | Success Chinese Restaurant | 2026-06-13 |
| Bill Chan | Wins Japanese Restaurant | 2026-06-20 |

- First column: Member names (who can vote)
- Other columns: Categories to vote on (Venue, Date, etc.)

**Responses Sheet** - Auto-filled when members vote:
| VoteId | MemberName | Votes | VotedAt | Status |
|--------|------------|-------|---------|--------|
| uuid-123 | Johnny Li | {"Venue":"JW Hotel","Date":"May 30, 2026"} | 2026-05-28T08:30:00Z | active |

## Setup Instructions

### 1. Google Sheets + Apps Script Setup

1. Create a new [Google Sheet](https://sheets.google.com)
2. Go to **Extensions → Apps Script**
3. Delete any existing code and paste the contents of `apps-script.gs`
4. Click **Save** (💾)
5. Run **`setup()`** function once:
   - Select `setup` from the dropdown
   - Click **Run** (▶)
   - Authorize when prompted
6. Verify the sheets were created:
   - Go back to your Google Sheet
   - You should see two new sheets: "Questions" and "Responses"
7. Add your members and options to the "Questions" sheet:
   - Column A: Member names
   - Column B: Venue options
   - Column C: Date options (or other categories)

### 2. Deploy as Web App

1. In Apps Script, click **Deploy** → **New deployment**
2. Select **Web app** as the type
3. Configure:
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone (⚠️ This is CRITICAL - must be "Anyone", not "Anyone with link")
4. Click **Deploy**
5. **Copy the URL** - it will look like: `https://script.google.com/macros/s/ABC123.../exec`
6. Click **Done**

### 3. Configure Frontend

1. Open `config.js` and update the API URL:
   ```javascript
   window.ENROLL_CONFIG = {
     apiUrl: "https://script.google.com/macros/s/YOUR_ID/exec",
     refreshInterval: 10000,
   };
