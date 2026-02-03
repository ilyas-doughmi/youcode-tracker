# YouCode Tracker



A Chrome extension for YouCode Intranet that helps you track Veille and Live Coding assignments across your entire class.

![Preview](./images/preview.jpg)

## Features

- **Class Scanning**: Automatically detects all students on the current page and fetches their assignments
- **Assignment Types**: Filter by Veille or Live Coding
- **Date Filtering**: View assignments for this week or all time
- **Visual Date Status**:
  - Gray: Past assignments
  - Orange: Today's assignments
  - Green: Tomorrow's assignments
  - Blue: Future assignments
- **Grouped View**: Same assignments with multiple presenters are grouped together
- **Profile Photos**: Shows real profile pictures from the intranet
- **Parallel Fetching**: Fast scanning using concurrent requests

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in top right)
3. Click **Load Unpacked**
4. Select the `youcode-tracker` folder

## Usage

1. Navigate to a YouCode Intranet page with student listings (e.g., Leaderboard, Class View, Trombinoscope)
2. The extension panel will appear in the top-right corner
3. Click the **SCAN** button to fetch assignments for all visible students
4. Use the filters to switch between:
   - **All** / **Veille** / **Live Coding**
   - **This Week** / **All Time**

## Files

```
youcode-tracker/
├── manifest.json       # Extension configuration
├── content_main.js     # Main logic
├── styles.css          # UI styles
└── README.md           # This file
```

## Requirements

- Google Chrome browser
- Access to YouCode Intranet (must be logged in)
- jQuery must be available on the page (included by default on intranet)

## Color Legend

| Color  | Status   | Meaning                     |
|--------|----------|-----------------------------|
| Gray   | Past     | Assignment date has passed  |
| Orange | Today    | Assignment is today         |
| Green  | Tomorrow | Assignment is tomorrow      |
| Blue   | Future   | Assignment is in the future |

## Notes

- The extension only works on `*.youcode.ma` domains
- You must be logged into the intranet for fetching to work
- Navigate to a page with student profile links before scanning
- Assignments are grouped by title and datetime

## Author

Created for YouCode students to easily track class presentations.

## Version

1.0.0
