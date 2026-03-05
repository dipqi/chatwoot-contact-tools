# Chatwoot Tools

A set of browser-native utilities for managing Chatwoot campaigns. All processing happens locally in your browser to ensure data privacy.

## Features

- **Import & Label**: Batch import contacts from CSV and automatically create/assign campaign-specific labels. Supports strict header validation (`NAME`, `PHONE`) and auto-identification for header-less files.
- **Export**: Fetch and download labels and contacts as CSV files.
- **Mass Delete**: Quickly remove contacts in bulk.
- **Privacy First**: All operations are performed directly against the Chatwoot API from your browser. No data is sent to intermediate servers.
- **Persistence**: Securely stores API credentials in your browser's local storage (optional).

## Getting Started

### Prerequisites

- Node.js 20 or later
- A running Chatwoot instance with API access

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Usage

1. Open `http://localhost:3000`
2. Configure your Chatwoot API URL and Access Token.
3. Use the sidebar to navigate between Import, Export, and Delete tools.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Parsing**: PapaParse
- **Icons**: Lucide React
- **Notifications**: Sonner

---
Created by [Dipqi](https://dipqi.net) with ❤️.
