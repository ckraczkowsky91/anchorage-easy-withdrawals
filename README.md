Instructions:

// Create the API key (you only need to do this once ever)
1. Open a new terminal window
2. Point to this directory
3. Execute the command "node utils/generateKeys.js"
4. Save the results to keys.txt, you'll want to refer to this later
5. Open the Client Dashboard and navigate to the API 2.0 section
6. Click on "Create API Key" (it is assumed that you already have a Permission Group with Initiate Withdrawal and Read permissions)
7. Fill in requested information, when you get to "Add public key" go to keys.txt and copy/paste the value indicated as the public key
8. Once available, copy/paste the API Access Key from the Client Dashboard into a new line in keys.txt
9. Open the index.js file and fill "const ANCHORAGE_API_KEY" with the API Access Key and fill "const secretKeyHex" with the value from keys.txt indicated as the secret key hex


// Prepare the withdrawals
1. Make a copy of withdrawals.csv from Google Sheets: https://docs.google.com/spreadsheets/d/1hh2v0BuGXWKWcnju8aJ7sL_V5m5zhBHnXx6NkJXKFDg/edit#gid=0
2. Fill out spreadsheet
3. Ensure that all information is correct (e.g. destination addresses are all accurately entered)
4. Download the spreadsheet as a .csv file and save in this directory as "withdrawals.csv" overwriting the existing file (your output should look similar to the "withdrawals-example.csv")

// Submit the withdrawals
1. Open a new terminal window
2. Point to this directory
3. Make sure that there are no existing transactions for this vault
3. Execute the command "node index.js"
4. Allow the script to run, do not let the machine go to sleep until all transactions have been submitted
