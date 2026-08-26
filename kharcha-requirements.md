# Kharcha --- Expense Tracker Web App Requirements

## 1. Project Overview

Build a simple personal expense tracking web application called
**Kharcha**.

**Tagline:**\
\> Simple expense tracking.

### Technology

-   Frontend: React.js
-   Backend: Node.js + Express.js
-   Database: MongoDB + Mongoose
-   Authentication: Email/password + Google OAuth
-   Receipt images: server-side storage or suitable object/file storage,
    with the stored URL/path saved in MongoDB

### Core principle

Kharcha is designed for **fast manual expense entry**.

The primary workflow is:

**Open Kharcha → Add Expense → Save → Done**

The application must NOT read SMS, connect to bank accounts, scan UPI
transactions, automatically detect expenses, or use AI categorization.

------------------------------------------------------------------------

# 2. Authentication

Authentication is required because each user's expenses, categories,
profile, and settings must be private.

## 2.1 Login

Create a clean Login page containing:

-   Kharcha branding
-   Email
-   Password
-   Login button
-   Continue with Google button
-   Forgot Password link
-   Link to Sign Up

Example:

``` text
Kharcha
Simple expense tracking.

Email
[________________]

Password
[________________]

[ Login ]

──────── OR ────────

[ Continue with Google ]

Don't have an account?
[ Create Account ]

[ Forgot Password? ]
```

## 2.2 Sign Up

Create a Sign Up page containing:

-   Name
-   Email
-   Password
-   Confirm Password
-   Create Account button
-   Continue with Google
-   Link to Login

Example:

``` text
Kharcha
Simple expense tracking.

Name
[________________]

Email
[________________]

Password
[________________]

Confirm Password
[________________]

[ Create Account ]

──────── OR ────────

[ Continue with Google ]

Already have an account?
[ Login ]
```

## 2.3 Google Authentication

Provide:

> Continue with Google

on both Login and Sign Up.

Use proper Google OAuth on the backend. Do not create a fake Google
login form.

## 2.4 Authentication validation

Handle:

-   Invalid email
-   Incorrect password
-   Existing email
-   Password mismatch
-   Weak password
-   Google authentication failure
-   Network/server errors

Messages should be short and understandable.

Example:

> Email or password is incorrect.

## 2.5 Password security

-   Never store plain-text passwords.
-   Hash passwords using a secure password hashing algorithm such as
    Argon2 or bcrypt.
-   Password input must support show/hide.
-   Minimum password length: 8 characters.

## 2.6 Protected routes

The following areas require authentication:

-   Add Expense
-   Dashboard
-   Expense Details
-   Profile
-   Settings
-   Categories

Unauthenticated users attempting to access protected pages should be
redirected to Login.

After successful authentication, open the **Add Expense** page.

## 2.7 Logout

Profile should contain a Logout option.

Before logging out:

``` text
Log out of Kharcha?

[ Cancel ] [ Logout ]
```

After logout:

-   Clear the authenticated session/token appropriately.
-   Return to Login.

------------------------------------------------------------------------

# 3. User Data Isolation

Every authenticated user must have their own:

-   Expenses
-   Categories
-   Profile
-   Settings

A user must never be able to access another user's expenses or
categories.

The backend must determine the authenticated user's identity from the
authenticated session/token.

Do NOT trust a `userId` supplied by the frontend when creating or
modifying data.

------------------------------------------------------------------------

# 4. Main Application Navigation

After authentication, use a simple navigation system.

### Mobile bottom navigation

``` text
[ Add Expense ]   [ Dashboard ]   [ Profile ]
```

The **Add Expense** screen is the default screen after login.

### Desktop

Use a simple sidebar or top navigation if appropriate.

Do not create unnecessary navigation items.

------------------------------------------------------------------------

# 5. Add Expense --- Primary Screen

This is the most important screen in Kharcha.

When the user opens the app after login, open **Add Expense** directly.

The screen must prioritize speed.

## 5.1 Fields

### Amount

Required.

-   Numeric input
-   INR currency
-   Positive values only
-   Large and easy to focus

Example:

``` text
Amount
₹ [150]
```

### Category

Required.

Use the user's custom categories.

Initial default categories:

-   Food
-   Travel
-   Shopping
-   Education
-   Bills
-   Entertainment
-   Health
-   Other

Categories are NOT permanently hard-coded.

### Description

Optional.

Placeholder:

> Add description (optional)

The user must be able to save an expense without a description.

### Receipt

Optional.

Button:

> -   Add Receipt

Supported formats:

-   JPG/JPEG
-   PNG
-   WebP

Show a thumbnail after selection.

Allow:

-   Preview
-   Remove
-   Replace

### Date

Required.

-   Default to today's date.
-   User can change the date.
-   Store the selected date as the expense date.

### Submit

Primary button:

> Add Expense

After successful submission:

-   Save the expense.
-   Show a short success indication.
-   Reset the form.
-   Allow the user to quickly enter another expense.
-   Provide access to Dashboard.

The user must be able to create an expense using only:

**Amount + Category + Date**

Description and receipt are optional.

------------------------------------------------------------------------

# 6. Dashboard

Dashboard is secondary to Add Expense.

Show:

## 6.1 Selected Month

Example:

``` text
< August 2026 >

Current Month Expense
₹8,450
```

Allow:

-   Previous month
-   Next month

The total must update according to the selected month.

## 6.2 Expense List

Display expenses newest first.

Prefer grouping by date.

Example:

``` text
TODAY — 26 AUGUST

🍔 Food
Lunch
₹150

🚌 Travel
Bus
₹50

YESTERDAY — 25 AUGUST

📚 Education
Notebook
₹200

🛍 Shopping
Shoes
₹900
```

Each expense must be clickable.

## 6.3 Category Filters

Provide:

``` text
All
Food
Travel
Shopping
Education
Bills
Entertainment
Health
Other
```

These must use the user's current categories.

If a user adds a category called `Gym`, it should automatically appear
in the filters.

If a category is renamed, the filter must use the new name.

The selected filter should have a clear visual state.

## 6.4 Empty State

If there are no expenses:

``` text
No expenses yet

Add your first expense to start tracking.

[ + Add Expense ]
```

------------------------------------------------------------------------

# 7. Expense Details

When the user clicks a specific expense, open a details page or clean
modal.

Show:

-   Amount
-   Category
-   Date
-   Description if available
-   Receipt if available
-   Edit
-   Delete

Example:

``` text
Food
₹150

26 August 2026

Description
Lunch with friends

Receipt
[ Receipt Image ]

[ Edit Expense ]
[ Delete ]
```

## 7.1 Optional Information

Description and receipt are optional.

If there is no description:

``` text
Description

No description added

[ + Add Description ]
```

If there is no receipt:

``` text
Receipt

No receipt added

[ + Add Receipt ]
```

Do not display large empty boxes for missing information.

------------------------------------------------------------------------

# 8. Progressive Expense Editing

A user may be in a hurry when recording an expense.

Therefore, the user must be able to save:

``` text
₹150
Food
26 August
```

and add information later.

For example:

1.  Create expense with amount/category/date.
2.  Open expense later.
3.  Add description.
4.  Save.
5.  Later add a receipt.
6.  Replace or remove the receipt if needed.

The user should not need to recreate the expense.

------------------------------------------------------------------------

# 9. Edit Expense

The user can edit:

-   Amount
-   Category
-   Description
-   Receipt
-   Date

If the expense already contains a description:

``` text
Description
Lunch with friends

[ Edit ]
```

If there is no description:

``` text
Description
No description added

[ + Add Description ]
```

If there is an existing receipt:

-   Show thumbnail.
-   Provide `Replace Receipt`.
-   Provide `Remove Receipt`.

If there is no receipt:

> -   Add Receipt

Save changes with:

> Save Changes

------------------------------------------------------------------------

# 10. Delete Expense

The user can delete an expense.

Show confirmation:

``` text
Delete this expense?

[ Cancel ] [ Delete ]
```

After confirmation:

-   Delete the MongoDB expense.
-   Delete its receipt file if appropriate.
-   Remove it from the UI.

------------------------------------------------------------------------

# 11. Receipt Requirements

Receipt upload is optional.

## Upload

-   JPG/JPEG
-   PNG
-   WebP
-   Maximum recommended size: 5 MB

Validate the file on both frontend and backend.

Do not trust the original filename.

Generate a safe unique filename.

## Display

If a receipt exists:

-   Show thumbnail.
-   Clicking opens a larger preview.
-   Allow replacement.
-   Allow removal.

If no receipt exists:

> Receipt not added

with:

> -   Add Receipt

## Storage

MongoDB should store only the receipt URL/path, not unnecessarily large
image binary data.

------------------------------------------------------------------------

# 12. Profile

Add Profile to the bottom navigation.

Profile should show:

-   User profile image
-   Name
-   Email
-   Edit Profile
-   Settings
-   Logout

Example:

``` text
        [ Profile Image ]

        Light
        light@example.com

        [ Edit Profile ]

Settings

[ Categories ]
[ Appearance ]
[ Backup & Data ]
[ About ]

[ Logout ]
```

------------------------------------------------------------------------

# 13. Edit Profile

Allow the user to change:

-   Name
-   Email, if supported safely
-   Profile image

Example:

``` text
Edit Profile

Name
[ Light ]

Email
[ light@example.com ]

Profile Image
[ Change Image ]

[ Cancel ] [ Save Changes ]
```

If email changes are supported, handle verification appropriately.

------------------------------------------------------------------------

# 14. Category Management

Categories are user-controlled.

The user must be able to:

-   Add category
-   Rename category
-   Delete category
-   Select/change category icon
-   Optionally reorder categories

Default categories:

``` text
Food
Travel
Shopping
Education
Bills
Entertainment
Health
Other
```

## 14.1 Add Category

Settings → Categories → Add Category

Example:

``` text
Category Name
[ Gym ]

Category Icon
[ 🏋️ ]

[ Cancel ] [ Add Category ]
```

After creation, the category immediately becomes available in:

-   Add Expense
-   Dashboard filters
-   Expense details/editing

## 14.2 Rename Category

Example:

``` text
Food → Restaurants
```

Renaming must NOT delete existing expenses.

Use a `categoryId` relationship instead of storing only the category
name in expenses.

## 14.3 Delete Category

Before deleting a category, check whether expenses use it.

If existing expenses exist, provide a safe option such as:

> Move existing expenses to Other

or cancel the deletion.

Never make existing expenses inaccessible.

------------------------------------------------------------------------

# 15. Settings

Settings should be accessible from Profile.

Keep settings minimal.

Sections:

### Categories

Manage user categories.

### Appearance

Options:

-   Light
-   Dark
-   System

### Backup & Data

-   Export Expenses
-   Import Expenses
-   Clear All Data

### About

Show:

-   Kharcha
-   Version
-   Basic app information

------------------------------------------------------------------------

# 16. Backup & Data

Provide simple data management.

## Export

Allow the user to export their expense data.

Recommended formats:

-   JSON
-   CSV

Receipt images should either be included in a documented backup process
or clearly explained if they are not included.

## Import

Allow importing supported backup data.

Validate imported data before inserting it.

## Clear All Data

Show a strong confirmation:

``` text
Delete all expenses and data?

This action cannot be undone.

[ Cancel ] [ Delete Everything ]
```

------------------------------------------------------------------------

# 17. Data Models

## 17.1 User

Suggested MongoDB document:

``` js
{
  _id: ObjectId,
  name: String,
  email: String,
  passwordHash: String | null,
  googleId: String | null,
  profileImage: String | null,
  settings: {
    theme: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 17.2 Category

Prefer a separate MongoDB collection.

``` js
{
  _id: ObjectId,
  userId: ObjectId,
  name: String,
  icon: String,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

This makes category renaming and deletion safer.

## 17.3 Expense

``` js
{
  _id: ObjectId,
  userId: ObjectId,
  categoryId: ObjectId,
  amount: Number,
  description: String,
  receiptUrl: String | null,
  date: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Important

Expenses should reference `categoryId`, NOT only a category name.

This means changing:

``` text
Food
```

to:

``` text
Restaurants
```

automatically updates the displayed category for existing expenses
without modifying every expense.

------------------------------------------------------------------------

# 18. Backend API

Use Node.js + Express.js.

## Authentication

``` http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/google
GET  /api/auth/google/callback
```

If using a frontend-oriented Google OAuth library/provider, adapt the
routes to the selected implementation.

## Expenses

``` http
POST   /api/expenses
GET    /api/expenses
GET    /api/expenses/:id
PUT    /api/expenses/:id
DELETE /api/expenses/:id
```

Optional filters:

``` text
GET /api/expenses?month=2026-08
GET /api/expenses?categoryId=...
GET /api/expenses?month=2026-08&categoryId=...
```

## Monthly summary

``` http
GET /api/expenses/summary/monthly?month=2026-08
```

Example:

``` json
{
  "month": "2026-08",
  "total": 8450
}
```

## Categories

``` http
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
```

## Profile

``` http
GET /api/profile
PUT /api/profile
```

## Backup

``` http
GET  /api/backup/export
POST /api/backup/import
```

------------------------------------------------------------------------

# 19. Authentication Security

Use secure authentication practices.

-   Never store plain-text passwords.
-   Use Argon2 or bcrypt.
-   Use secure session cookies or a properly implemented token strategy.
-   Use HTTPS in production.
-   Validate authentication on the backend.
-   Protect all user-specific routes.
-   Never trust a client-supplied userId.
-   Ensure every database query is scoped to the authenticated user.
-   Configure CORS correctly.
-   Use secure environment variables.
-   Do not expose secrets to React.

Google OAuth credentials must remain on the backend/server environment.

------------------------------------------------------------------------

# 20. Frontend Structure

Suggested React structure:

``` text
client/
└── src/
    ├── components/
    │   ├── BottomNav.jsx
    │   ├── ExpenseCard.jsx
    │   ├── ExpenseDetails.jsx
    │   ├── ExpenseForm.jsx
    │   ├── CategoryFilter.jsx
    │   ├── CategorySelector.jsx
    │   ├── ReceiptPreview.jsx
    │   ├── ConfirmDialog.jsx
    │   └── ProfileHeader.jsx
    │
    ├── pages/
    │   ├── Login.jsx
    │   ├── SignUp.jsx
    │   ├── AddExpense.jsx
    │   ├── Dashboard.jsx
    │   ├── ExpenseDetailsPage.jsx
    │   ├── Profile.jsx
    │   ├── Settings.jsx
    │   └── Categories.jsx
    │
    ├── services/
    │   ├── authApi.js
    │   ├── expenseApi.js
    │   ├── categoryApi.js
    │   └── profileApi.js
    │
    ├── hooks/
    │   ├── useAuth.js
    │   └── useExpenses.js
    │
    ├── utils/
    │   └── formatters.js
    │
    ├── App.jsx
    └── main.jsx
```

------------------------------------------------------------------------

# 21. Backend Structure

Suggested structure:

``` text
server/
├── controllers/
│   ├── authController.js
│   ├── expenseController.js
│   ├── categoryController.js
│   └── profileController.js
│
├── models/
│   ├── User.js
│   ├── Expense.js
│   └── Category.js
│
├── routes/
│   ├── authRoutes.js
│   ├── expenseRoutes.js
│   ├── categoryRoutes.js
│   └── profileRoutes.js
│
├── middleware/
│   ├── authMiddleware.js
│   ├── uploadMiddleware.js
│   └── errorMiddleware.js
│
├── uploads/
├── config/
├── utils/
├── server.js
├── .env
└── package.json
```

------------------------------------------------------------------------

# 22. UI / UX Requirements

Kharcha should feel like a simple personal expense notebook.

## Design principles

-   Minimal
-   Clean
-   Fast
-   Mobile-first
-   Easy to understand
-   Large touch targets
-   Clear typography
-   Minimal visual clutter
-   No unnecessary animations

Avoid:

-   Complex financial dashboards
-   Stock-market visuals
-   Excessive charts
-   AI features
-   SMS tracking
-   Bank integrations
-   Excessive gradients
-   Glassmorphism
-   Large decorative illustrations
-   Unnecessary settings

------------------------------------------------------------------------

# 23. Mobile Design

Mobile is the primary platform.

The Add Expense screen must be optimized for quick one-handed use.

Category filters may horizontally scroll.

Expense items must be easy to tap.

Bottom navigation should remain simple:

``` text
＋ Add Expense
🏠 Dashboard
👤 Profile
```

------------------------------------------------------------------------

# 24. Desktop Design

On desktop:

-   Use a centered content area or simple sidebar.
-   Avoid stretching content across the full screen.
-   Maintain readable expense lists.
-   Keep the Add Expense form compact.

------------------------------------------------------------------------

# 25. Date Handling

Every expense has a date.

The selected date determines:

-   Month grouping
-   Monthly total
-   Dashboard display
-   Monthly filtering

Display newest expenses first.

Avoid timezone-related date shifting.

------------------------------------------------------------------------

# 26. Validation

Validate on both frontend and backend.

### Amount

Reject:

-   Empty
-   Zero
-   Negative
-   Invalid numeric values

### Category

Required.

Must belong to the authenticated user's categories.

### Description

Optional.

### Receipt

Optional.

Validate file type and size.

### Date

Required and valid.

------------------------------------------------------------------------

# 27. Loading States

Show loading states for:

-   Login
-   Google authentication
-   Loading dashboard
-   Loading expenses
-   Adding expense
-   Editing expense
-   Uploading receipt
-   Deleting expense
-   Saving profile
-   Managing categories

Prevent duplicate submissions.

------------------------------------------------------------------------

# 28. Error Handling

Handle:

-   Invalid credentials
-   Authentication failures
-   Expired sessions
-   MongoDB failures
-   API failures
-   Invalid IDs
-   Upload errors
-   Invalid files
-   Duplicate categories
-   Category deletion conflicts
-   Failed imports

Do not expose server stack traces to users.

------------------------------------------------------------------------

# 29. Suggested Project Structure

``` text
kharcha/
│
├── client/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── uploads/
│   ├── config/
│   ├── utils/
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

# 30. Environment Variables

Example backend environment variables:

``` env
PORT=5000
MONGODB_URI=your_mongodb_connection_string

SESSION_SECRET=your_secure_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=your_google_callback_url

UPLOAD_DIR=uploads
```

Never commit `.env` to Git.

------------------------------------------------------------------------

# 31. Out of Scope for V1

Do NOT implement:

-   SMS reading
-   Bank integration
-   UPI transaction detection
-   Automatic transaction imports
-   AI expense categorization
-   OCR receipt scanning
-   Investment tracking
-   Income tracking
-   Debt tracking
-   Budget management
-   Recurring expenses
-   Complex financial analytics
-   Multiple currencies
-   Social features
-   Unnecessary notifications

These may be considered in future versions.

------------------------------------------------------------------------

# 32. Future Features

Possible future additions:

-   PWA installation
-   Cloud backup
-   More detailed reports
-   Simple charts
-   CSV export
-   Recurring expenses
-   Custom dashboard widgets
-   Advanced search
-   Expense tags
-   Multi-currency support

Only add these after the basic app is stable.

------------------------------------------------------------------------

# 33. Definition of Done

V1 is complete when an authenticated user can:

1.  Sign up with email/password.
2.  Sign in with email/password.
3.  Sign in with Google.
4.  Log out.
5.  Open Kharcha directly on Add Expense after login.
6.  Enter an amount.
7.  Select a category.
8.  Add an optional description.
9.  Add an optional receipt.
10. Select a date.
11. Save an expense quickly.
12. Open the Dashboard.
13. See the selected month's total.
14. Navigate between months.
15. Filter expenses by category.
16. Click an expense to see details.
17. Add a description later if one was not provided.
18. Add a receipt later if one was not provided.
19. Replace or remove a receipt.
20. Edit an expense.
21. Delete an expense after confirmation.
22. Open Profile.
23. Edit profile information.
24. Change profile image.
25. Open Settings.
26. Add categories.
27. Rename categories.
28. Delete categories safely.
29. See custom categories in Add Expense.
30. See custom categories in Dashboard filters.
31. Change appearance between Light, Dark, and System.
32. Export/import expense data.
33. Clear all data only after confirmation.
34. Never access another user's data.

------------------------------------------------------------------------

# 34. Most Important Product Rule

Do not lose sight of what Kharcha is.

It is a **simple manual expense tracker**.

The ideal experience is:

``` text
OPEN KHARCHA
      ↓
ADD AMOUNT
      ↓
SELECT CATEGORY
      ↓
ADD EXPENSE
      ↓
DONE
```

Description and receipt are optional and can be added later.

The Dashboard is for reviewing expenses.

Profile and Settings are for customization.

Authentication protects the user's data.

Everything else is secondary.
