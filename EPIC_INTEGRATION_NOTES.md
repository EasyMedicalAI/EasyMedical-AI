# Epic Integration - Data Preservation

## Critical Requirement
When Epic EHR is integrated, ALL existing locally-stored records must be preserved. This is a MERGE operation, not a REPLACE operation.

## What Should Happen
1. User connects Epic account
2. App fetches records from Epic
3. Epic records are added to existing local records
4. Duplicate detection prevents duplicates
5. User sees complete history (manual uploads + Epic records)

## What Should NOT Happen
❌ Delete any existing local records
❌ Replace local records with Epic records
❌ Lose any manually uploaded data
❌ Clear the database on Epic connection

## Implementation Checklist
- [ ] epicService.fetchRecords() adds to existing records, doesn't replace
- [ ] Duplicate detection based on date + provider + summary
- [ ] Merge logic preserves all unique records
- [ ] User sees confirmation of how many records were added from Epic
- [ ] All metrics and data from local uploads remain intact

## Testing
Before Epic feature is complete:
1. Upload 5 manual records
2. Connect Epic account
3. Verify all 5 manual records still exist
4. Verify Epic records are added alongside them
5. Check metrics from manual uploads still display correctly
