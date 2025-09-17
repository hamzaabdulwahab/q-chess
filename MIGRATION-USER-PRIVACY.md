# Database Migration: Fix User Game Privacy

## Problem
All users were seeing all games in their archive because games weren't associated with specific users.

## Solution
Added user ownership to games with proper Row Level Security (RLS) policies.

## Migration Steps

### 1. Apply Database Migration
Run the SQL migration in your Supabase SQL editor:

```sql
-- Copy and paste the contents of migration-add-user-ownership.sql
```

Or run it via command line:
```bash
# If you have supabase CLI installed
supabase db reset
```

### 2. Code Changes Applied
- ✅ Updated `games` API route to require authentication and filter by user
- ✅ Added `ChessService.getUserGames(userId)` method  
- ✅ Updated `ChessService.createNewGame()` to include user_id
- ✅ Games table now has `user_id` column with proper RLS policies
- ✅ Moves table policies updated to respect game ownership

### 3. What This Fixes
- ❌ **Before**: All users saw all games in archive (privacy breach)
- ✅ **After**: Users only see their own games
- ✅ Users can only create/modify/delete their own games
- ✅ Moves are protected by game ownership

### 4. Testing
1. Create new user account
2. Create some games
3. Switch to different user account  
4. Verify archive only shows that user's games
5. Verify user cannot access other users' games via API

### 5. Data Migration Notes
- Existing games without user_id will have `user_id = null`
- These games won't be visible to any user (you may want to delete them)
- All new games will be properly associated with their creators

## Security Improvements
- ✅ Row Level Security enforces user isolation at database level
- ✅ API routes require authentication
- ✅ Frontend will only receive user's own data
- ✅ No way for users to access other users' games