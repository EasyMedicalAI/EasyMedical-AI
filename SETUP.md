# EasyMedical Setup Guide

## Getting Your Claude API Key

EasyMedical uses the Claude API to intelligently parse and summarize your medical records. Follow these steps to get your API key:

### Step 1: Sign Up / Log In
1. Go to https://console.anthropic.com/
2. Sign in with your existing account or create a new one
3. If you don't have an Anthropic account, sign up at https://www.anthropic.com/

### Step 2: Create an API Key
1. Navigate to the **API Keys** section in your account settings
2. Click **Create Key** button
3. Give your key a descriptive name (e.g., "EasyMedical")
4. Click **Create**
5. **Copy the key immediately** (you won't be able to see it again)

### Step 3: Add to EasyMedical
1. Open `.env.local` in the EasyMedical folder
2. Replace the placeholder with your actual API key:
   ```
   EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-v1-xxxxxxxxxxxxx
   ```
3. **Save the file**
4. The app will pick up the key after you restart the dev server

### Step 4: Verify It Works
1. Start the app: `npm start`
2. Go to the Upload tab
3. Upload any medical record (photo or text)
4. If Claude processes it successfully, you'll see the extracted information

## Understanding API Usage

### Costs
- Claude operates on a pay-as-you-go model
- Each record upload uses approximately 500-1000 tokens
- Visit https://www.anthropic.com/pricing to see current pricing
- Monitor your usage at https://console.anthropic.com/

### Rate Limits
- Free tier: 50,000 tokens/month (approximately 50-100 records)
- Paid tier: Varies based on plan
- See your current usage in the console dashboard

## Troubleshooting

### "Invalid API Key" Error
- ✅ Verify you copied the entire key correctly
- ✅ Make sure there are no extra spaces
- ✅ Check that `.env.local` file exists
- ✅ Restart the dev server after updating `.env.local`

### "API Key Not Found" Error
- ✅ Confirm `.env.local` exists in the app root
- ✅ Check the key is prefixed with `EXPO_PUBLIC_ANTHROPIC_API_KEY=`
- ✅ Verify the key is not blank

### "Quota Exceeded" Error
- ✅ You've used your monthly token limit
- ✅ Upgrade your plan or wait until next month
- ✅ Check usage at https://console.anthropic.com/

### App Doesn't Parse Records
- ✅ Check your API key is valid
- ✅ Ensure you have network connectivity
- ✅ Try again - temporary API issues can occur
- ✅ Check the app console for error messages

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Add your Claude API key to `.env.local`
3. ✅ Start the app: `npm start`
4. ✅ Upload your first medical record
5. ✅ Explore your records organized by specialty

## Security Notes

- **Never commit your API key** - it's already in `.gitignore`
- **Keep your key private** - treat it like a password
- **Rotate your key** if you suspect it's been compromised
- **All records are stored locally** on your device, not uploaded to Anthropic (except images sent for processing)

## Getting Help

- Check the README.md for general project information
- Review error messages in the app for specific guidance
- Visit https://support.anthropic.com/ for API support
- Check your network connection if Claude API calls fail

## Regional Availability

Claude API is available globally. If you're in a region with restrictions, you may need to use a VPN or check current availability at https://www.anthropic.com/
