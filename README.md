<h1>Instructions</h1>

<h2>Initial Setup - do once</h2>

<h3>Get this project</h3>

1. Open a new terminal window
2. Execute the command "git clone https://github.com/ckraczkowsky91/anchorage-easy-withdrawals.git"

<h3>Create the API key</h3>

1. In the terminal window from the previous section, execute the command "cd anchorage-easy-withdrawals/"
3. The execute the command "node generateKeys.js"
4. Outputs to a file called keys.json
5. Open the Client Dashboard and navigate to the API 2.0 section
6. Click on "Create API Key" (it is assumed that you already have a Permission Group with Initiate Withdrawal and Read permissions)
7. Fill in requested information, when you get to "Add public key" go to keys.txt and copy/paste the value indicated as the public key
8. Once available, copy/paste the API Access Key from the Client Dashboard into the anchorageApiKey property in keys.json. The default value should be "REPLACE_WITH_API_KEY"

<h2>Continuous Setup - do for each payroll</h2>

<h3>Prepare the withdrawals</h3>

1. Make a copy of withdrawals.csv from Google Sheets: https://docs.google.com/spreadsheets/d/1hh2v0BuGXWKWcnju8aJ7sL_V5m5zhBHnXx6NkJXKFDg/edit#gid=0
2. Fill out spreadsheet
3. Ensure that all information is correct (e.g. destination addresses are all accurately entered)
4. Download the spreadsheet as a .csv file and save in this directory as "withdrawals.csv" overwriting the existing file (your output should look similar to the "withdrawals-example.csv")

<h3>Submit the withdrawals</h3>

1. Open a new terminal window
2. Point to this directory
3. Make sure that there are no existing transactions for this vault
3. Execute the command "node index.js"
4. Allow the script to run, do not let the machine go to sleep until all withdrawals have been submitted

<h3>Things to Note</h3>
- Successful transactions will be written to a file called successfulWithdrawals.csv and failed ones go to fialedWithdrawals.csv
- Only 1 withdrawal can be run at once, that means you need to get approval for a withdrawal before the next one can be kicked off. This is a limitation with our APIs and for now cannot be worked around
- After running the tool, withdrawals.csv will be cleared of all content to prevent accidental re-running of the same transactions
- The last withdrawals ran will be stored in previousWithdrawals.csv

<h3>Error Handling</h3>

The application runs a few checks to make sure input data is correct and that transactions have gone through properly. 

Here is a list of different errors the application will handle:
- Checks to make sure you set an API key, if it doesn't find a keys.json file or that the anchorageApiKey property is the same value it will let you know
- Checks to make sure your withdrawal csv file is there and valid, if any line is missing data it will let you know what it is missing and which transaction has the problem
- If the API fails to create a withdrawal it will print out any failed transaction into a failedWithdrawals.csv with the parameters along with two extra columns with error type and error message. You should be able to copy these back into withdrawals.csv to re-run them.
