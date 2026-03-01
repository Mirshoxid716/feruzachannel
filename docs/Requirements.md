# Software Requirements Specification (SRS)
Feruza Channel – Lesson Material Download Website

Version 1.1

## 1. Introduction
### 1.1 Purpose
This document defines the requirements for a lightweight website supporting the YouTube channel Feruza Channel.
The website allows viewers to receive lesson materials (PDF, PPTX, DOC, etc.) via email using a secure magic link system with email verification.

### 1.2 Scope
The system shall:
- Provide a public landing page.
- List YouTube lessons.
- Generate unique magic links for lesson materials.
- Require email verification before sending materials (Double Opt-In).
- Send lesson materials via SMTP.
- Include a contact form.
- Provide minimal admin functionality.
- Use Node.js + Express backend.
- Use lightweight frontend (HTML, CSS, JS).
- Store data in SQLite/MySQL.

### 1.3 Definitions
- **Magic Link** – Unique unguessable URL tied to a lesson.
- **Lesson Material** – Downloadable file (PDF, PPTX, DOC).
- **Double Opt-In** – Email verification before delivering material.
- **SMTP** – Email sending protocol.

## 2. Overall Description
### 2.1 Product Perspective
Standalone website integrated with YouTube.
Each video contains a magic link directing users to download material.

### 2.2 Users
- **Primary Users:** YouTube viewers learning Japanese.
- **Administrator:** Channel owner managing lessons and emails.

### 2.3 Constraints
- Backend: Node.js + Express (no heavy ORM)
- Storage: SQLite/MySQL
- Email: SMTP
- Files stored on server
- Environment variables required for secrets

## 3. Functional Requirements
### 3.1 Landing Page
- **FR1:** The root URL (/) shall display a landing page.
- **FR2:** Landing page shall contain: Channel name, Branding, Introduction, Lesson list (YouTube links), Contact form.
- **FR3:** Design shall be responsive and clean.

### 3.2 Magic Link Pages
- **FR4:** Each lesson shall have a cryptographically random ID (minimum 16 characters).
- **FR5:** `GET /lesson/:id` shall: Validate lesson, Show title, Show email input, Show submit button.
- **FR6:** Invalid lesson ID shall return 404 page.

### 3.3 Email Request Flow
- **FR7:** `POST /request-lesson` shall: Accept lessonId and userEmail, Validate, Store request, Generate verification token, Send email.
- **FR7.3:** Double Opt-In verification email required.
- **FR7.4:** Verification link: One-time use, 24h expiration.
- **FR7.6:** `GET /verify/:token` shall: Validate, Send material via SMTP, Mark as used.

### 3.4 Contact Form
- **FR8:** Landing page contact form: Name, Email, Subject, Message.
- **FR9:** `POST /contact` shall: Validate, Send email to admin.

### 3.5 Admin Functions (Minimal v1)
- **FR10:** Admin features: Add lesson, Generate magic link, Enable/Disable, View requests.
- **FR10.1:** Password protected (env-based).

## 4. Non-Functional Requirements
- **NFR1:** Mobile-friendly.
- **NFR2:** Email error logging.
- **NFR3:** Unguessable magic links (16+ chars).
- **NFR5:** SMTP credentials in `.env`.
- **NFR9:** Rate limiting (max 5/hour).

## 5. Interface Requirements
- **5.1 User Interfaces:** Landing Page, Magic Link Page, Verification Page, Admin Page.
- **5.2 Software Interfaces:** SMTP Server, SQLite/MySQL.

## 6. Design Guidelines
- **Colors:** 
  - Red: `#D62828` (Japan)
  - Dark Blue: `#1D3557` (Uzbekistan)
  - Background: `#F1FAEE`
- **Branding:** Red CTA buttons, Dark Blue Header/Footer.
